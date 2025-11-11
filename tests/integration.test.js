const cheerio = require('cheerio');
const nock = require('nock');
const request = require('supertest');
const { sampleHtmlWithYale } = require('./test-utils');
const app = require('../app');

describe('Integration Tests', () => {
  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/^(127\.0\.0\.1|::1|localhost)(:\d+)?$/);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.title).toBe('Fale University Test Page');
    expect(response.body.content).toContain('Welcome to Fale University');
    expect(response.body.content).toContain('https://www.yale.edu/about');
    expect(response.body.content).toContain('>About Fale<');

    const $ = cheerio.load(response.body.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('a').first().attr('href')).toBe('https://www.yale.edu/about');
    expect($('a').first().text()).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    nock('https://error-site.com')
      .get('/')
      .replyWithError('Connection refused');

    await request(app)
      .post('/fetch')
      .send({ url: 'https://error-site.com/' })
      .expect(500)
      .expect(res => {
        expect(res.body.error).toContain('Failed to fetch content');
      });
  });

  test('Should handle missing URL parameter', async () => {
    await request(app)
      .post('/fetch')
      .send({})
      .expect(400)
      .expect(res => {
        expect(res.body.error).toBe('URL is required');
      });
  });
});
