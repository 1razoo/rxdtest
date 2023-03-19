import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import {
  Utxo,
  utxoHelper,
  updateUtxos,
  buildTx,
} from "../src/util";

describe("trueReturnFail", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("fails to create utxo with return before state separator", async () => {
    const tx = buildTx(coins, [
      [`OP_TRUE OP_RETURN OP_STATESEPERATOR`, 1]
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError('bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)');
  });

  it("creates true return utxo", async () => {
    const tx = buildTx(coins, [
      [`OP_TRUE OP_RETURN`, 1]
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("fails to spend true return utxo", async () => {
    const tx = buildTx(coins, []);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toReturnError('mandatory-script-verify-flag-failed (OP_RETURN was encountered) (code 16)');
  });
});
