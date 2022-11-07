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

describe("refDataSummary", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  let refs: string[];

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates outputs", async () => {
    const splitTx = buildSplitTx(coins[0], 4);
    const splitResponse = await rpc("sendrawtransaction", [splitTx.toString()]);
    expect(splitResponse).toBeValidTx();
    coins = updateUtxos(coins[0], splitResponse.data.result, splitTx);

    refs = coins.map(buildRef);

    const tx = buildTx(coins, [
      `OP_PUSHINPUTREF ${refs[1]} OP_DROP OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_PUSHINPUTREFSINGLETON ${refs[3]} OP_DROP OP_PUSHINPUTREF ${refs[4]} OP_DROP OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`,
      `OP_PUSHINPUTREF ${refs[2]} OP_DROP OP_1`,
      `OP_REQUIREINPUTREF ${refs[2]} OP_DROP OP_1`,
      `OP_0 OP_REFDATASUMMARY_UTXO ${refs[0]}${refs[1]}${refs[3]}${refs[4]} OP_EQUALVERIFY OP_1 OP_REFDATASUMMARY_UTXO ${refs[2]} OP_EQUALVERIFY OP_2 OP_REFDATASUMMARY_UTXO OP_0 OP_EQUALVERIFY OP_3 OP_REFDATASUMMARY_UTXO OP_0 OP_EQUALVERIFY ` +
        `OP_1 OP_REFDATASUMMARY_OUTPUT ${refs[0]}${refs[1]}${refs[3]}${refs[4]} OP_EQUALVERIFY OP_2 OP_REFDATASUMMARY_OUTPUT ${refs[2]} OP_EQUALVERIFY OP_3 OP_REFDATASUMMARY_OUTPUT OP_0 OP_EQUALVERIFY OP_0 OP_REFDATASUMMARY_OUTPUT OP_0 OP_EQUAL`,
    ]);

    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct data summaries", async () => {
    const tx = buildTx(coins, [
      `OP_1`,
      coins[0].script,
      coins[1].script,
      coins[2].script,
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
