import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import { Utxo, utxoHelper, updateUtxos, buildTx } from "../src/util";

describe("codeScriptHashValueSum", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  const Op1Hash =
    "953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee0";
  const Op2Hash =
    "a99843c5b0e2290f3bac80d8845f718095c6af84092f449ccf10769647095bca";
  const OtherHash =
    "1111111111111111111111111111111111111111111111111111111111111111";

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const tx = buildTx(coins, [
      [`OP_STATESEPERATOR OP_1`, 3],
      [`OP_STATESEPERATOR OP_1`, 2],
      [`OP_STATESEPERATOR OP_2`, 6],
      `${Op1Hash} OP_CODESCRIPTHASHVALUESUM_UTXOS OP_5 OP_EQUALVERIFY ` +
        `${Op2Hash} OP_CODESCRIPTHASHVALUESUM_UTXOS OP_6 OP_EQUALVERIFY ` +
        `${OtherHash} OP_CODESCRIPTHASHVALUESUM_UTXOS OP_0 OP_EQUAL`,
      `${Op1Hash} OP_CODESCRIPTHASHVALUESUM_OUTPUTS OP_7 OP_EQUALVERIFY ` +
        `${Op2Hash} OP_CODESCRIPTHASHVALUESUM_OUTPUTS OP_8 OP_EQUALVERIFY ` +
        `${OtherHash} OP_CODESCRIPTHASHVALUESUM_OUTPUTS OP_0 OP_EQUAL`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct sum", async () => {
    const tx = buildTx(coins, [
      [`OP_STATESEPERATOR OP_1`, 1],
      [`OP_STATESEPERATOR OP_1`, 6],
      [`OP_STATESEPERATOR OP_2`, 8],
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
