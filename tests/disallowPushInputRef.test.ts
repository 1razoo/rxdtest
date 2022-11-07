import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import { Utxo, utxoHelper, buildTx, buildRef } from "../src/util";

describe("disallowPushInputRef", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];

  // Replace to bypass radiantjs checks
  const tmp =
    "888888888888888888888888888888888888888888888888888888888888888888888888";

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("disallows ref", async () => {
    const ref = buildRef(coins[0]);
    const tx = buildTx(coins, [
      `OP_PUSHINPUTREF ${ref} OP_DROP OP_DISALLOWPUSHINPUTREF ${tmp} OP_DROP OP_1`,
    ]);
    expect(
      await rpc("sendrawtransaction", [tx.toString().replace(tmp, ref)])
    ).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  it("disallows singleton ref", async () => {
    const ref = buildRef(coins[0]);
    const tx = buildTx(coins, [
      `OP_PUSHINPUTREFSINGLETON ${ref} OP_DROP OP_DISALLOWPUSHINPUTREF ${tmp} OP_DROP OP_1`,
    ]);
    expect(
      await rpc("sendrawtransaction", [tx.toString().replace(tmp, ref)])
    ).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });
});
