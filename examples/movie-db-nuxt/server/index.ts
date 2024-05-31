import express from 'express'
import { container } from './application/container'

const app = express()

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
    })
})

const movieRouter = container.resolve('MovieRouter')

app.use('/movies', movieRouter)

export default fromNodeMiddleware(app)
