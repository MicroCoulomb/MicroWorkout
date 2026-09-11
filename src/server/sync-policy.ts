export function planRemovalMode(hasSessions: boolean): "archive" | "delete" {
  return hasSessions ? "archive" : "delete";
}

export function resolvePlanOperation(operation: "upsert" | "delete", wasDeleted: boolean): "upsert" | "delete" {
  return operation === "upsert" && wasDeleted ? "delete" : operation;
}
