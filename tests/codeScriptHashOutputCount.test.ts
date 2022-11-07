import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import {
  Utxo,
  utxoHelper,
  updateUtxos,
  buildTx,
  buildRef,
  buildSplitTx,
} from "../src/util";

describe("codeScriptHashOutputCount", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  const op1Hash =
    "953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee0";
  const op2Hash =
    "a99843c5b0e2290f3bac80d8845f718095c6af84092f449ccf10769647095bca";
  const otherHash =
    "1111111111111111111111111111111111111111111111111111111111111111";

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const tx = buildTx(coins, [
      [`OP_STATESEPERATOR OP_1`, 0],
      [`OP_STATESEPERATOR OP_1`, 0],
      `OP_STATESEPERATOR OP_1`,
      `OP_STATESEPERATOR OP_2`,
      `${op1Hash} OP_CODESCRIPTHASHOUTPUTCOUNT_UTXOS OP_3 OP_EQUALVERIFY ${op1Hash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_UTXOS OP_2 OP_EQUALVERIFY ` +
        `${op2Hash} OP_CODESCRIPTHASHOUTPUTCOUNT_UTXOS OP_1 OP_EQUALVERIFY ${op2Hash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_UTXOS OP_0 OP_EQUALVERIFY ` +
        `${otherHash} OP_CODESCRIPTHASHOUTPUTCOUNT_UTXOS OP_0 OP_EQUALVERIFY ${otherHash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_UTXOS OP_0 OP_EQUALVERIFY ` +
        `${op1Hash} OP_CODESCRIPTHASHOUTPUTCOUNT_OUTPUTS OP_5 OP_EQUALVERIFY ${op1Hash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_OUTPUTS OP_3 OP_EQUALVERIFY ` +
        `${op2Hash} OP_CODESCRIPTHASHOUTPUTCOUNT_OUTPUTS OP_2 OP_EQUALVERIFY ${op2Hash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_OUTPUTS OP_0 OP_EQUALVERIFY ` +
        `${otherHash} OP_CODESCRIPTHASHOUTPUTCOUNT_OUTPUTS OP_0 OP_EQUALVERIFY ${otherHash} OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_OUTPUTS OP_0 OP_EQUAL`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct count", async () => {
    const tx = buildTx(coins, [
      [`OP_STATESEPERATOR OP_1`, 0],
      [`OP_STATESEPERATOR OP_1`, 0],
      [`OP_STATESEPERATOR OP_1`, 0],
      `OP_STATESEPERATOR OP_1`,
      `OP_STATESEPERATOR OP_1`,
      `OP_STATESEPERATOR OP_2`,
      `OP_STATESEPERATOR OP_2`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("melts", async () => {
    const tx = buildTx(coins, []);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
  });
});
