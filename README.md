# rxdtest

1. Start testnet. Must have wallet support and coins to fund tests.
```
radiantd -testnet
```

2. Create .env file
```
RPC_HOSTNAME=127.0.0.1
RPC_PORT=7332
RPC_USERNAME=user
RPC_PASSWORD=password
```

3. Install
```
pnpm install
```

4. Run tests
```
pnpm test
```
