export default {
  test: {
    // Server + shared run in the Node environment. The Godot client has its own
    // test tooling and lives outside this TypeScript workspace.
    exclude: ['**/node_modules/**'],
  },
};
