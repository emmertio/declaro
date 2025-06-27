# @declaro/auth

A simple authentication library for Declaro projects.

## Features

-   Basic username and password authentication

## Installation

### bun

```bash
bun add @declaro/auth
```

### npm

```bash
npm install @declaro/auth
```

### yarn

```bash
yarn add @declaro/auth
```

## Usage

```typescript
import { authenticate } from '@declaro/auth'

const isAuthenticated = authenticate('admin', 'password')
console.log(isAuthenticated) // true
```

## License

MIT
