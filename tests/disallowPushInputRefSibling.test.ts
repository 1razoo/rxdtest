import client, { JsonRpc } from "../src/rpc";
import {
  GetUtxo,
  Utxo,
  utxoHelper,
  updateUtxos,
  swap,
  outpointHex,
  buildMintTx,
  buildTransferTx,
  buildMeltTx,
} from "../src/util";
import {
  Script,
  Transaction,
  // @ts-ignore
} from "@radiantblockchain/radiantjs";

describe("disallowPushInputRefSibling", () => {
  let rpc: JsonRpc;
  let getUtxo: GetUtxo;
  let coins: Utxo;
  let token: Utxo;
  let change: Utxo;
  let script: string;
  let ref: string;

  beforeAll(async () => {
    rpc = await client();
    getUtxo = utxoHelper(rpc);
    coins = await getUtxo(100000000);
  });

  it("mints", async () => {
    const { privKey, ...input } = coins;
    const { address } = input;
    ref = `${swap(input.txId)}${outpointHex(input.outputIndex)}`;
    script = Script.fromASM(
      `OP_PUSHINPUTREF ${ref} OP_DROP OP_DISALLOWPUSHINPUTREFSIBLING ${ref} OP_DROP OP_1`
    ).toHex();

    const tx = buildMintTx(input, script, address, privKey);

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();

    [token, change] = updateUtxos(coins, txId, tx);
  });

  it("disallows sibling ref", async () => {
    const { address, privKey } = token;

    const invalidScript = Script.fromASM(
      `OP_PUSHINPUTREF ${ref} OP_DROP OP_1`
    ).toHex();

    const tx = new Transaction()
      .addInput(
        new Transaction.Input({
          prevTxId: token.txId,
          outputIndex: token.outputIndex,
          script: "",
          satoshis: 1,
          output: {
            script,
            satoshis: 1,
          },
        })
      )
      .from(change)
      .addOutput(
        new Transaction.Output({
          script,
          satoshis: 1,
        })
      )
      .addOutput(
        new Transaction.Output({
          script: invalidScript,
          satoshis: 1,
        })
      )
      .change(address)
      .sign(privKey)
      .seal();

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    expect(data.error.message).toBe(
      "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
    );
  });

  it("transfers", async () => {
    const { address, privKey } = token;

    const tx = buildTransferTx(token, change, script, address, privKey);

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();

    [token, change] = updateUtxos(token, txId, tx);
  });

  it("melts", async () => {
    const { address, privKey } = token;

    const tx = buildMeltTx([[token, script]], change, address, privKey);

    const { data } = await rpc("sendrawtransaction", [tx.toString()]);
    const { result: txId } = data;
    expect(txId.length).toBe(64);
    expect(data.error).toBeNull();
  });
});
