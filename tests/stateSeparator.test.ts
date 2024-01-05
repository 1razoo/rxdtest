import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import { Utxo, utxoHelper, updateUtxos, buildTx } from "../src/util";

describe("stateSeparator", () => {
  let rpc: JsonRpc;
  let coins: Utxo;

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = await getUtxo(100000000);
  });

  it("allows op return after state separator", async () => {
    const tx = buildTx([coins], ["OP_STATESEPARATOR OP_RETURN"]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    [, coins] = updateUtxos(coins, response.data.result, tx);
  });

  it("disallows op return before state separator", async () => {
    const tx = buildTx([coins], ["OP_RETURN OP_STATESEPARATOR OP_1"]);

    expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  it("disallows multiple state separators", async () => {
    const tx = buildTx([coins], ["OP_STATESEPARATOR OP_STATESEPARATOR OP_1"]);

    expect(await rpc("sendrawtransaction", [tx.toString()])).toReturnError(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });
});
