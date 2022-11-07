import "./extendExpect";
import client, { JsonRpc } from "../src/rpc";
import {
  Utxo,
  utxoHelper,
  updateUtxos,
  buildTx,
  buildSplitTx,
  buildRef,
} from "../src/util";

describe("refValueSum", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  let refs: string[];
  const otherRef =
    "111111111111111111111111111111111111111111111111111111111111111111111111";

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const splitTx = buildSplitTx(coins[0], 1);
    const split = await rpc("sendrawtransaction", [splitTx.toString()]);
    coins = updateUtxos(coins[0], split.data.result, splitTx);
    refs = coins.map(buildRef);

    const tx = buildTx(coins, [
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 2],
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 3],
      [`OP_REQUIREINPUTREF ${refs[0]} OP_DROP OP_1`, 4],
      [`OP_PUSHINPUTREF ${refs[1]} OP_DROP OP_1`, 8],
      `${refs[0]} OP_REFVALUESUM_UTXOS OP_5 OP_EQUALVERIFY ` +
        `${refs[1]} OP_REFVALUESUM_UTXOS OP_8 OP_EQUALVERIFY ` +
        `${otherRef} OP_REFVALUESUM_UTXOS OP_0 OP_EQUALVERIFY ` +
        `${refs[0]} OP_REFVALUESUM_OUTPUTS OP_6 OP_EQUALVERIFY ` +
        `${refs[1]} OP_REFVALUESUM_OUTPUTS OP_9 OP_EQUALVERIFY ` +
        `${otherRef} OP_REFVALUESUM_OUTPUTS OP_0 OP_EQUAL`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct sum", async () => {
    const tx = buildTx(coins, [
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 2],
      [`OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`, 4],
      [`OP_REQUIREINPUTREF ${refs[0]} OP_DROP OP_1`, 4],
      [`OP_PUSHINPUTREF ${refs[1]} OP_DROP OP_1`, 9],
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
