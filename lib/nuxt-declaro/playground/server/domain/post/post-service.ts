export class PostService {
    async getPosts() {
        return [
            { id: 1, title: 'Post 1', content: 'Content 1' },
            { id: 2, title: 'Post 2', content: 'Content 2' },
            { id: 3, title: 'Post 3', content: 'Content 3' },
        ]
    }
}
