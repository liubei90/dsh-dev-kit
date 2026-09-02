// API service entry. This file is the server bootstrap placeholder.
export function createServer() {
  return { listen: (port: number) => console.log(`api listening on ${port}`) }
}
