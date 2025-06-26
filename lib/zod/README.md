# @declaro/zod

A library for Zod-based models in the Declaro ecosystem.

## Installation

```bash
# Using bun
bun add @declaro/zod

# Using npm
npm install @declaro/zod

# Using yarn
yarn add @declaro/zod
```

## Usage

```typescript
import { ZodModel } from '@declaro/zod'
import { z } from 'zod'

const userModel = new ZodModel(
    'User',
    z.object({
        name: z.string(),
        age: z.number(),
    }),
)

const result = await userModel.validate({ name: 'Alice', age: 30 })
console.log(result)
```

## License

MIT
