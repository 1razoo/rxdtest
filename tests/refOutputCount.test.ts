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

describe("refOutputCount", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  let refs: string[];

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const splitTx = buildSplitTx(coins[0], 1);

    const splitResponse = await rpc("sendrawtransaction", [splitTx.toString()]);
    expect(splitResponse).toBeValidTx();
    coins = updateUtxos(coins[0], splitResponse.data.result, splitTx);

    refs = coins.map(buildRef);

    const tx = buildTx(coins, [
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 0],
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 0],
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`,
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`,
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_PUSHINPUTREFSINGLETON ${refs[1]} OP_DROP OP_1`,
      `${refs[0]} OP_REFOUTPUTCOUNT_UTXOS OP_5 OP_EQUALVERIFY ${refs[1]} OP_REFOUTPUTCOUNT_UTXOS OP_1 OP_EQUALVERIFY 000000000000000000000000000000000000000000000000000000000000000000000000 OP_REFOUTPUTCOUNT_UTXOS OP_0 OP_EQUALVERIFY ` +
        `${refs[0]} OP_REFOUTPUTCOUNTZEROVALUED_UTXOS OP_2 OP_EQUALVERIFY ` +
        `${refs[0]} OP_REFOUTPUTCOUNT_OUTPUTS OP_4 OP_EQUALVERIFY ${refs[1]} OP_REFOUTPUTCOUNT_OUTPUTS OP_1 OP_EQUALVERIFY 000000000000000000000000000000000000000000000000000000000000000000000000 OP_REFOUTPUTCOUNT_OUTPUTS OP_0 OP_EQUALVERIFY ` +
        `${refs[0]} OP_REFOUTPUTCOUNTZEROVALUED_OUTPUTS OP_2 OP_EQUAL`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct count", async () => {
    const tx = buildTx(coins, [
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 0],
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 0],
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`,
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_PUSHINPUTREF ${refs[1]} OP_DROP OP_1`,
      `OP_REQUIREINPUTREF ${refs[0]} OP_DROP OP_1`,
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
