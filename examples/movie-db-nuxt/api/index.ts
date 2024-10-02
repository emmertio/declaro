import express from 'express'
import { container } from './application/container'

// registerSchema(registry)

const app = express()

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
    })
})

const documentationRouter = container.resolve('DocumentationRouter')
app.use('/docs', documentationRouter)

// const movieRouter = container.resolve('MovieRouter')

// app.use('/movies', movieRouter)

export default fromNodeMiddleware(app)
