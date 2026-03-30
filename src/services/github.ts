import axios from 'axios';

export const githubService = {
  async getAuthUrl() {
    const response = await axios.get('/api/auth/url'); // This was for generic OAuth, but I implemented /api/auth/github/login in server.ts
    // Wait, I should use the correct endpoint from server.ts
    const res = await axios.get('/api/auth/github/login');
    return res.data.url;
  },

  async fetchRepos(encryptedToken: string) {
    const response = await axios.post('/api/github/proxy', {
      encryptedToken,
      endpoint: '/user/repos?sort=updated&per_page=100'
    });
    return response.data;
  },

  async fetchFileContent(encryptedToken: string, repoFullName: string, path: string) {
    try {
      const response = await axios.post('/api/github/proxy', {
        encryptedToken,
        endpoint: `/repos/${repoFullName}/contents/${path}`
      });
      if (response.data.content) {
        return atob(response.data.content);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${path}:`, error);
      return null;
    }
  },

  async fetchRepoStructure(encryptedToken: string, repoFullName: string) {
    const response = await axios.post('/api/github/proxy', {
      encryptedToken,
      endpoint: `/repos/${repoFullName}/git/trees/main?recursive=1` // Try main branch
    }).catch(async () => {
       // Fallback to master if main fails
       return await axios.post('/api/github/proxy', {
         encryptedToken,
         endpoint: `/repos/${repoFullName}/git/trees/master?recursive=1`
       });
    });
    return response.data;
  }
};
