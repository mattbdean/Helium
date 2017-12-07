// Install all global mocha hooks here

before(async () => {
    // Catch unhandled Promises
    process.on('unhandledRejection', (reason) => {
        process.stderr.write("Unhandled Promise rejection:\n");
        console.error(reason);
    });
});
