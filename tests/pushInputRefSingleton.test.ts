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
  // @ts-ignore
} from "@radiantblockchain/radiantjs";

describe("pushInputRefSigleton", () => {
  let rpc: JsonRpc;
  let getUtxo: GetUtxo;
  let coins: Utxo;

  beforeAll(async () => {
    rpc = await client();
    getUtxo = utxoHelper(rpc);
    coins = await getUtxo(100000000);
  });

  it("disallows invalid tx id", async () => {
    const { privKey, ...input } = coins;
    const { address } = input;

    const tx = buildMintTx(
      input,
      Script.fromASM(
        "OP_PUSHINPUTREFSINGLETON 000000000000000000000000000000000000000000000000000000000000000000000000 OP_1"
      ).toHex(),
      address,
      privKey
    );
    try {
      await rpc("sendrawtransaction", [tx.toString()]);
    } catch (err: any) {
      expect(err.response.data.error.message).toBe(
        "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
      );
    }
  });

  it("disallows invalid outpoint", async () => {
    const { privKey, ...input } = coins;
    const { address } = input;
    const tx = buildMintTx(
      input,
      Script.fromASM(
        `OP_PUSHINPUTREFSINGLETON ${swap(coins.txId)}00000001 OP_1`
      ).toHex(),
      address,
      privKey
    );
    try {
      await rpc("sendrawtransaction", [tx.toString()]);
    } catch (err: any) {
      expect(err.response.data.error.message).toBe(
        "bad-txns-inputs-outputs-invalid-transaction-reference-operations-mempool (code 19)"
      );
    }
  });

  describe("token", () => {
    let token: Utxo;
    let change: Utxo;
    let script: string;

    it("mints", async () => {
      const { privKey, ...input } = coins;
      const { address } = input;
      script = Script.fromASM(
        `OP_PUSHINPUTREFSINGLETON ${swap(input.txId)}${outpointHex(
          input.outputIndex
        )} OP_DROP OP_1`
      ).toHex();

      const tx = buildMintTx(input, script, address, privKey);

      const { data } = await rpc("sendrawtransaction", [tx.toString()]);
      const { result: txId } = data;
      expect(txId.length).toBe(64);
      expect(data.error).toBeNull();

      [token, change] = updateUtxos(coins, txId, tx);
    });

    it("disallows duplicate singleton", async () => {
      const { address, privKey } = token;

      const tx = buildTransferTx(
        token,
        change,
        script,
        address,
        privKey,
        [1, 1]
      );

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
});
