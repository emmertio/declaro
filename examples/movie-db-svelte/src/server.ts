export default startServer((context) => {
	// Provide a server
	context.use(expressMiddleware());

	// Configure redis
	context.use(
		redisMiddleware({
			// redis config
		})
	);

	// Config database
	context.use(
		dbMiddleware({
			type: 'postgres'
			// db config
		})
	);

	context.on(AppEvent.Start, (context) => {
		const app = useExpress(context);
		const serverConfig = useServerConfig(context);

		app.listen(serverConfig.port, () => {
			console.log(`Server listening on port ${serverConfig.port}`);
		});
	});
});
