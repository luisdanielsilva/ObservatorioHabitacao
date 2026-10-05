import { beforeEach, describe, expect, it } from "vitest";
import { createDb, migrateDb, type Db } from "./client";
import { deleteAccount } from "./account";
import {
  addPhoto,
  deletePhoto,
  getPhoto,
  listPhotos,
  PHOTO_LIMITS,
  photoUsage,
  scenarioIdsOfUser,
} from "./photos";
import { createScenario, deleteScenario } from "./scenarios";
import { parameterSets, scenarioPhotos, users } from "./schema";
import { seed } from "./seed";

let db: Db;
let scenarioId: number;
let n = 0;
const photo = (bytes = 100_000) => ({
  fileName: `p${++n}.webp`,
  originalName: "sala.jpg",
  mimeType: "image/webp",
  bytes,
  width: 1600,
  height: 1200,
});

beforeEach(() => {
  db = createDb(":memory:");
  migrateDb(db);
  seed(db);
  db.insert(users)
    .values([
      { id: "ana", email: "ana@example.pt" },
      { id: "rui", email: "rui@example.pt" },
    ])
    .run();
  scenarioId = createScenario(db, "ana", {
    name: "T2",
    property: {},
    inputs: {},
    results: null,
    parameterSetId: db.select().from(parameterSets).get()!.id,
  }).id;
});

describe("scenario photos", () => {
  it("are added, listed and deleted by the scenario's owner only", () => {
    const added = addPhoto(db, "ana", scenarioId, photo());
    expect(added.status).toBe("added");
    expect(addPhoto(db, "rui", scenarioId, photo()).status).toBe("not_found");
    expect(listPhotos(db, scenarioId, "ana")).toHaveLength(1);
    expect(listPhotos(db, scenarioId, "rui")).toBeUndefined();

    const id = added.status === "added" ? added.photo.id : 0;
    expect(getPhoto(db, scenarioId, id, "rui")).toBeUndefined();
    expect(deletePhoto(db, scenarioId, id, "rui")).toBeUndefined();
    expect(deletePhoto(db, scenarioId, id, "ana")?.id).toBe(id);
    expect(photoUsage(db, scenarioId)).toEqual({ count: 0, bytes: 0 });
  });

  it("stop at 30 photos", () => {
    for (let i = 0; i < PHOTO_LIMITS.maxCount; i++) {
      expect(addPhoto(db, "ana", scenarioId, photo(1_000)).status).toBe("added");
    }
    expect(addPhoto(db, "ana", scenarioId, photo(1_000)).status).toBe("too_many");
  });

  it("stop at 5 MB in total, whichever limit comes first", () => {
    expect(addPhoto(db, "ana", scenarioId, photo(4_000_000)).status).toBe("added");
    expect(addPhoto(db, "ana", scenarioId, photo(1_500_000)).status).toBe("too_large");
    expect(addPhoto(db, "ana", scenarioId, photo(1_000_000)).status).toBe("added");
    expect(photoUsage(db, scenarioId)).toEqual({ count: 2, bytes: 5_000_000 });
  });

  it("go with their scenario and with the account", () => {
    addPhoto(db, "ana", scenarioId, photo());
    expect(scenarioIdsOfUser(db, "ana")).toEqual([scenarioId]);
    deleteScenario(db, scenarioId, "ana");
    expect(db.select().from(scenarioPhotos).all()).toHaveLength(0);

    const other = createScenario(db, "ana", {
      name: "T3",
      property: {},
      inputs: {},
      results: null,
      parameterSetId: db.select().from(parameterSets).get()!.id,
    }).id;
    addPhoto(db, "ana", other, photo());
    deleteAccount(db, "ana");
    expect(db.select().from(scenarioPhotos).all()).toHaveLength(0);
  });
});
