export async function prepareApplication({
    initializeDatabase,
    loadSettings,
    createApplication
}) {
    await initializeDatabase();
    await loadSettings();
    return createApplication();
}
