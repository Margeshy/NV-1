const { fetchUserInfo } = require('../services/apiService');
const axios = require('axios');

jest.mock('axios');

describe('fetchUserInfo', () => {
  it('should fetch user data', async () => {
    const mockData = { Id: 1, Username: 'testuser' };
    axios.get.mockResolvedValue({ data: mockData });

    const result = await fetchUserInfo('testuser');
    expect(result).toEqual(mockData);
  });
});