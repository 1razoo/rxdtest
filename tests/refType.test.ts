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

describe("refType", () => {
  let rpc: JsonRpc;
  let coins: Utxo[];
  let refs: string[];

  beforeAll(async () => {
    rpc = await client();
    const getUtxo = utxoHelper(rpc);
    coins = [await getUtxo(100000000)];
  });

  it("creates utxos", async () => {
    const splitTx = buildSplitTx(coins[0], 2);
    const splitResponse = await rpc("sendrawtransaction", [splitTx.toString()]);
    expect(splitResponse).toBeValidTx();

    coins = updateUtxos(coins[0], splitResponse.data.result, splitTx);

    refs = coins.map(buildRef);

    const tx = buildTx(coins, [
      `OP_PUSHINPUTREF ${refs[0]} OP_DUP OP_REFTYPE_UTXO OP_1 OP_EQUALVERIFY OP_REFTYPE_OUTPUT OP_1 OP_EQUAL`,
      `OP_PUSHINPUTREFSINGLETON ${refs[1]} OP_DUP OP_REFTYPE_UTXO OP_2 OP_EQUALVERIFY OP_REFTYPE_OUTPUT OP_2 OP_EQUAL`,
    ]);
    const response = await rpc("sendrawtransaction", [tx.toString()]);
    expect(response).toBeValidTx();
    coins = updateUtxos(coins[0], response.data.result, tx);
  });

  it("has correct ref types", async () => {
    const tx = buildTx(coins, [
      `OP_PUSHINPUTREF ${refs[0]} OP_DROP OP_1`,
      `OP_PUSHINPUTREFSINGLETON ${refs[1]} OP_DROP OP_1`,
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
