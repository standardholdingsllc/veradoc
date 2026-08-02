import "server-only";
import type { CreateChargeInput, CreateChargeResult, CulqiCharge } from "./culqi-types";

export function createMockCharge(input: CreateChargeInput): CreateChargeResult {
  const charge: CulqiCharge = {
    object: "charge",
    id: `chr_test_mock_${Date.now()}`,
    amount: input.amount,
    source: {
      object: "token",
      id: input.source_id,
      type: input.source_id.startsWith("ype") ? "yape" : "card",
    },
    response_code: "venta_exitosa",
    merchant_message: "Mock: La transacción fue autorizada.",
    user_message: "Su compra ha sido exitosa.",
  };
  return { kind: "succeeded", charge };
}
