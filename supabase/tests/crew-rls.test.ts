// Crew-lite privacy and rules, checked against the real migrations in a test
// database. Ana, Ben and Cy are in one crew; Dee is in another; Eve has none.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./db";

let t: TestDb;
let ana: string, ben: string, cy: string, dee: string, eve: string;
let crewId: string;
let inviteCode: string;

// Onboards a user straight in the database, with settled (or provisional)
// stats: strength 120 (B), speed 50 (D), endurance 10 (F), intelligence 80 (C).
async function onboard(userId: string, provisional = false) {
  await t.admin(
    "update profiles set onboarded_at = now(), main_class = 'scholar', goal = 'Read', daily_minutes = 30 where id = $1",
    [userId],
  );
  await t.admin(
    `insert into stats (user_id, stat, points, provisional, best_grade, last_active_on)
     select $1, s, p, $2, case when $2 then null else 'B' end, current_date
       from (values ('strength', 120), ('speed', 50), ('endurance', 10),
                    ('intelligence', 80), ('potential', 75)) v(s, p)`,
    [userId, provisional],
  );
}

// A quest the user cleared today with this proof. Returns its id.
async function clearedQuest(userId: string, proof: "evidence" | "honour", gain = 10, awarded?: number) {
  const [q] = await t.admin<{ id: string }>(
    `insert into quests (user_id, type, source, title, stat, difficulty_rank, gain,
                         allowed_proofs, issued_on, due_on, status, completed_at)
     values ($1, 'side', 'user', 'Read 20 pages', 'intelligence', 2, $2,
             array['evidence', 'honour'], current_date, current_date, 'cleared', now())
     returning id`,
    [userId, gain],
  );
  const points = awarded ?? Math.round(gain * (proof === "evidence" ? 0.8 : 0.5));
  await t.admin(
    `insert into quest_proofs (quest_id, user_id, proof_type, summary, points_awarded)
     values ($1, $2, $3, $4, $5)`,
    [q.id, userId, proof, proof === "evidence" ? "I read twenty pages of my book today." : null, points],
  );
  return q.id;
}

async function giveCard(userId: string, kind: string, status = "held") {
  const [c] = await t.admin<{ id: string }>(
    `insert into cards (user_id, kind, tier, status, source, treat, questline_id)
     values ($1, $2, 'Silver', $3, 'dev',
             case when $2 = 'reward' then 'Coffee' end,
             case when $2 = 'skill' then 'test-line' end)
     returning id`,
    [userId, kind, status],
  );
  return c.id;
}

const rpc = async <T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) =>
  t.asUser<T>(user, sql, params);

beforeAll(async () => {
  t = await createTestDb();
  [ana, ben, cy, dee, eve] = await Promise.all(
    ["Ana", "Ben", "Cy", "Dee", "Eve"].map((n) => t.createUser(n)),
  );
  for (const u of [ana, ben, dee, eve]) await onboard(u);
  await onboard(cy, true); // Cy is still in the calibration week

  [{ create_crew: crewId }] = await rpc<{ create_crew: string }>(ana, "select create_crew('Night Owls')");
  [{ invite_code: inviteCode }] = await rpc<{ invite_code: string }>(ana, "select invite_code from crews");
  await rpc(ben, "select join_crew($1)", [inviteCode.toLowerCase()]);
  await rpc(cy, "select join_crew($1)", [inviteCode]);
  await rpc(dee, "select create_crew('Other Crew')");
}, 120_000);

describe("crew tables", () => {
  it("members can read their own crew and its member list", async () => {
    const crews = await rpc(ben, "select id, name from crews");
    expect(crews).toEqual([{ id: crewId, name: "Night Owls" }]);
    const members = await rpc(ben, "select user_id from crew_members");
    expect(members).toHaveLength(3);
  });

  it("non-members see no crews, so invite codes cannot be browsed", async () => {
    expect(await rpc(eve, "select * from crews")).toEqual([]);
    expect(await rpc(eve, "select * from crew_members")).toEqual([]);
  });

  it("members of another crew cannot see this one", async () => {
    const crews = await rpc<{ name: string }>(dee, "select name from crews");
    expect(crews.map((c) => c.name)).toEqual(["Other Crew"]);
    const members = await rpc<{ user_id: string }>(dee, "select user_id from crew_members");
    expect(members.map((m) => m.user_id)).toEqual([dee]);
  });

  it("nobody can write the crew tables directly", async () => {
    await expect(rpc(ana, "update crews set name = 'Hacked'")).rejects.toThrow(/permission denied/);
    await expect(
      rpc(eve, "insert into crew_members (crew_id, user_id, role) values ($1, $2, 'owner')", [crewId, eve]),
    ).rejects.toThrow(/permission denied/);
    await expect(rpc(ben, "delete from crew_members")).rejects.toThrow(/permission denied/);
  });
});

describe("crewmates' stats stay private", () => {
  it("a crewmate cannot read another member's stats, profile, quests or proofs", async () => {
    const quest = await clearedQuest(ana, "evidence");
    expect(await rpc(ben, "select * from stats where user_id = $1", [ana])).toEqual([]);
    expect(await rpc(ben, "select * from profiles where id = $1", [ana])).toEqual([]);
    expect(await rpc(ben, "select * from quests where id = $1", [quest])).toEqual([]);
    expect(await rpc(ben, "select * from quest_proofs where quest_id = $1", [quest])).toEqual([]);
    expect(await rpc(ben, "select * from stat_history where user_id = $1", [ana])).toEqual([]);
  });

  it("the grade summary has letter grades only, no points", async () => {
    const rows = await rpc<Record<string, unknown>>(ben, "select * from crew_member_summaries()");
    const anaRow = rows.find((r) => r.user_id === ana)!;
    expect(anaRow).toMatchObject({
      display_name: "Ana",
      main_class: "scholar",
      role: "owner",
      strength: "B",
      speed: "D",
      endurance: "F",
      intelligence: "C",
      potential: "C",
    });
    expect(Object.keys(anaRow).sort()).toEqual(
      ["display_name", "endurance", "intelligence", "joined_at", "main_class", "potential",
       "role", "speed", "strength", "user_id"].sort(),
    );
  });

  it("provisional grades are hidden from the crew", async () => {
    const rows = await rpc<Record<string, unknown>>(ana, "select * from crew_member_summaries()");
    const cyRow = rows.find((r) => r.user_id === cy)!;
    expect([cyRow.strength, cyRow.speed, cyRow.endurance, cyRow.intelligence, cyRow.potential]).toEqual([
      null, null, null, null, null,
    ]);
  });

  it("outsiders get no summaries", async () => {
    expect(await rpc(eve, "select * from crew_member_summaries()")).toEqual([]);
    const deeView = await rpc<{ user_id: string }>(dee, "select user_id from crew_member_summaries()");
    expect(deeView.map((r) => r.user_id)).toEqual([dee]);
  });
});

describe("joining", () => {
  it("refuses a second crew, a wrong code, and users who have not onboarded", async () => {
    await expect(rpc(ben, "select join_crew($1)", [inviteCode])).rejects.toThrow(/already in a crew/);
    await expect(rpc(eve, "select join_crew('ZZZZZZ')")).rejects.toThrow(/No crew has that invite code/);
    const fresh = await t.createUser("Fresh");
    await expect(rpc(fresh, "select join_crew($1)", [inviteCode])).rejects.toThrow(/Finish onboarding/);
  });

  it("refuses the 31st member", async () => {
    const [{ create_crew: bigCrew }] = await rpc<{ create_crew: string }>(eve, "select create_crew('Big Crew')");
    const [{ invite_code: code }] = await rpc<{ invite_code: string }>(eve, "select invite_code from crews");
    for (let i = 0; i < 29; i++) {
      const u = await t.createUser(`Filler${i}`);
      await onboard(u);
      await rpc(u, "select join_crew($1)", [code]);
    }
    const [{ n }] = await t.admin<{ n: number }>(
      "select count(*)::int as n from crew_members where crew_id = $1", [bigCrew]);
    expect(n).toBe(30);
    const late = await t.createUser("Late");
    await onboard(late);
    await expect(rpc(late, "select join_crew($1)", [code])).rejects.toThrow(/full/);
  }, 60_000);

  it("only the owner can make a new invite code, and the old one stops working", async () => {
    await expect(rpc(ben, "select new_invite_code()")).rejects.toThrow(/Only the crew owner/);
    const [{ new_invite_code: code }] = await rpc<{ new_invite_code: string }>(ana, "select new_invite_code()");
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const outsider = await t.createUser("Outsider");
    await onboard(outsider);
    if (code !== inviteCode) {
      await expect(rpc(outsider, "select join_crew($1)", [inviteCode])).rejects.toThrow(/No crew/);
    }
    inviteCode = code;
  });
});

describe("crew proof confirmation", () => {
  it("a crewmate confirms a requested quest and the owner gets the top-up", async () => {
    const quest = await clearedQuest(ben, "evidence", 10);
    const [{ points: before }] = await t.admin<{ points: number }>(
      "select points from stats where user_id = $1 and stat = 'intelligence'", [ben]);

    await rpc(ben, "select request_crew_confirmation($1)", [quest]);
    const requests = await rpc<{ quest_id: string; summary: string }>(
      ana, "select quest_id, summary from crew_confirmation_requests()");
    expect(requests.map((r) => r.quest_id)).toContain(quest);

    const [{ confirm_crew_proof: topUp }] = await rpc<{ confirm_crew_proof: number }>(
      ana, "select confirm_crew_proof($1)", [quest]);
    expect(topUp).toBe(2);

    const [proof] = await t.admin<Record<string, unknown>>(
      "select proof_type, confirmed_by, points_awarded from quest_proofs where quest_id = $1", [quest]);
    expect(proof).toEqual({ proof_type: "crew", confirmed_by: ana, points_awarded: 10 });
    const [{ points: after }] = await t.admin<{ points: number }>(
      "select points from stats where user_id = $1 and stat = 'intelligence'", [ben]);
    expect(after).toBe(before + 2);

    await expect(rpc(cy, "select confirm_crew_proof($1)", [quest])).rejects.toThrow(/already confirmed/);
  });

  it("doubles the top-up when Double XP doubled the award", async () => {
    const quest = await clearedQuest(ben, "honour", 10, 10);
    await rpc(ben, "select request_crew_confirmation($1)", [quest]);
    const [{ confirm_crew_proof: topUp }] = await rpc<{ confirm_crew_proof: number }>(
      cy, "select confirm_crew_proof($1)", [quest]);
    expect(topUp).toBe(10);
  });

  it("nobody can confirm their own quest", async () => {
    const quest = await clearedQuest(ana, "honour");
    await rpc(ana, "select request_crew_confirmation($1)", [quest]);
    await expect(rpc(ana, "select confirm_crew_proof($1)", [quest])).rejects.toThrow(/your own quest/);
    const own = await rpc<{ quest_id: string }>(ana, "select quest_id from crew_confirmation_requests()");
    expect(own.map((r) => r.quest_id)).not.toContain(quest);
  });

  it("outsiders cannot see or confirm requests", async () => {
    const quest = await clearedQuest(ana, "evidence");
    await rpc(ana, "select request_crew_confirmation($1)", [quest]);
    expect(await rpc(dee, "select * from crew_confirmation_requests()")).toEqual([]);
    await expect(rpc(dee, "select confirm_crew_proof($1)", [quest])).rejects.toThrow(/not found/);
    await expect(rpc(eve, "select confirm_crew_proof($1)", [quest])).rejects.toThrow(/not found/);
  });

  it("a quest must be asked about before a crewmate can confirm it", async () => {
    const quest = await clearedQuest(ana, "evidence");
    await expect(rpc(ben, "select confirm_crew_proof($1)", [quest])).rejects.toThrow(/not found/);
  });

  it("cannot ask about someone else's quest, or one cleared over 3 days ago", async () => {
    const quest = await clearedQuest(ana, "evidence");
    await expect(rpc(ben, "select request_crew_confirmation($1)", [quest])).rejects.toThrow(/Quest not found/);
    await t.admin("update quests set completed_at = now() - interval '4 days' where id = $1", [quest]);
    await expect(rpc(ana, "select request_crew_confirmation($1)", [quest])).rejects.toThrow(/3 days/);
  });

  it("users cannot set confirmations directly", async () => {
    const quest = await clearedQuest(ben, "honour");
    await expect(
      rpc(ben, "update quest_proofs set proof_type = 'crew' where quest_id = $1", [quest]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("card gifting", () => {
  it("gifts a held System card to a crewmate", async () => {
    const card = await giveCard(ana, "shield");
    const [{ gift_card: status }] = await rpc<{ gift_card: string }>(
      ana, "select gift_card($1, $2)", [card, ben]);
    expect(status).toBe("held");
    expect(await rpc(ana, "select id from cards where id = $1", [card])).toEqual([]);
    const benCards = await rpc<{ gifted_by: string }>(ben, "select gifted_by from cards where id = $1", [card]);
    expect(benCards).toEqual([{ gifted_by: ana }]);
    await expect(rpc(ben, "select gift_card($1, $2)", [card, cy])).rejects.toThrow(/passed on/);
  });

  it("refuses Reward, Skill and Proof cards", async () => {
    for (const kind of ["reward", "skill", "day_one"]) {
      const card = await giveCard(ana, kind);
      await expect(rpc(ana, "select gift_card($1, $2)", [card, ben])).rejects.toThrow(/Only System cards/);
    }
  });

  it("refuses gifts outside the crew, to yourself, or of someone else's card", async () => {
    const card = await giveCard(ana, "reroll");
    await expect(rpc(ana, "select gift_card($1, $2)", [card, dee])).rejects.toThrow(/crewmate/);
    await expect(rpc(ana, "select gift_card($1, $2)", [card, ana])).rejects.toThrow(/crewmate/);
    await expect(rpc(ben, "select gift_card($1, $2)", [card, cy])).rejects.toThrow(/not in your hand/);
  });

  it("a gift to a full hand waits as pending", async () => {
    for (let i = 0; i < 10; i++) await giveCard(cy, "rest");
    const card = await giveCard(ana, "double_xp");
    const [{ gift_card: status }] = await rpc<{ gift_card: string }>(
      ana, "select gift_card($1, $2)", [card, cy]);
    expect(status).toBe("pending");
  });
});

describe("weekly contribution counts", () => {
  it("counts each member's cleared quests, confirmations and gifts this week", async () => {
    const [{ monday }] = await t.admin<{ monday: string }>(
      "select to_char(date_trunc('week', current_date), 'YYYY-MM-DD') as monday");
    const rows = await rpc<{ user_id: string; quests_cleared: number; proofs_confirmed: number; cards_gifted: number }>(
      ben, "select * from crew_week_counts($1)", [monday]);
    const byUser = Object.fromEntries(rows.map((r) => [r.user_id, r]));
    expect(Object.keys(byUser).sort()).toEqual([ana, ben, cy].sort());
    expect(byUser[ana].proofs_confirmed).toBe(1);
    expect(byUser[cy].proofs_confirmed).toBe(1);
    expect(byUser[ana].cards_gifted).toBe(2);
    expect(byUser[ben].quests_cleared).toBeGreaterThan(0);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["cards_gifted", "proofs_confirmed", "quests_cleared", "user_id"]);
  });

  it("refuses a week that does not start on Monday, and shows outsiders nothing", async () => {
    const [{ tuesday, monday }] = await t.admin<{ tuesday: string; monday: string }>(
      `select to_char(date_trunc('week', current_date) + interval '1 day', 'YYYY-MM-DD') as tuesday,
              to_char(date_trunc('week', current_date), 'YYYY-MM-DD') as monday`);
    await expect(rpc(ben, "select * from crew_week_counts($1)", [tuesday])).rejects.toThrow(/Monday/);
    const fresh = await t.createUser("NoCrew");
    expect(await rpc(fresh, "select * from crew_week_counts($1)", [monday])).toEqual([]);
  });
});

describe("leaving", () => {
  it("withdraws the leaver's open requests", async () => {
    const quest = await clearedQuest(cy, "evidence");
    await rpc(cy, "select request_crew_confirmation($1)", [quest]);
    await rpc(cy, "select leave_crew()");
    expect(await rpc(cy, "select * from crews")).toEqual([]);
    const requests = await rpc<{ quest_id: string }>(ana, "select quest_id from crew_confirmation_requests()");
    expect(requests.map((r) => r.quest_id)).not.toContain(quest);
    await expect(rpc(cy, "select leave_crew()")).rejects.toThrow(/not in a crew/);
  });

  it("passes ownership on when the owner leaves, and deletes an empty crew", async () => {
    await rpc(ana, "select leave_crew()");
    const members = await rpc<{ user_id: string; role: string }>(ben, "select user_id, role from crew_members");
    expect(members).toEqual([{ user_id: ben, role: "owner" }]);
    await rpc(ben, "select leave_crew()");
    expect(await t.admin("select * from crews where id = $1", [crewId])).toEqual([]);
  });

  it("deleting an account removes them from their crew", async () => {
    await t.admin("delete from auth.users where id = $1", [dee]);
    expect(await t.admin("select * from crews where name = 'Other Crew'")).toEqual([]);
  });
});
