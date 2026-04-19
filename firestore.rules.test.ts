import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";

/**
 * These tests verify the "Dirty Dozen" payloads against the security rules.
 */
describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "project-2e06afe8-d49b-4610-88d",
      firestore: {
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test("Reject Identity Spoofing in clients", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(alice.firestore().collection("clients").doc("client1").set({
      id: "client1",
      uid: "bob", // Spoofing bob
      name: "Spoof",
      status: "lead"
    }));
  });

  test("Reject Negative Investment in simulations", async () => {
    const alice = testEnv.authenticatedContext("alice");
    await assertFails(alice.firestore().collection("simulations").doc("sim1").set({
      id: "sim1",
      uid: "alice",
      name: "Bad Sim",
      initialInvestment: -100,
      interestRate: 5,
      period: 12,
      rateType: "annual",
      periodType: "months"
    }));
  });

  test("Reject Unauthorized List Access", async () => {
    const intruder = testEnv.authenticatedContext("intruder");
    // Listing where uid != intruder
    await assertFails(intruder.firestore().collection("clients").where("uid", "==", "alice").get());
  });
});
