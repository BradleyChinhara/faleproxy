/**
 * @jest-environment jsdom
 */

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildDom = () => {
  document.body.innerHTML = `
    <form id="url-form">
      <input id="url-input" />
      <button type="submit">Fetch</button>
    </form>
    <div id="loading" class="hidden"></div>
    <div id="error-message" class="hidden"></div>
    <div id="result-container" class="hidden"></div>
    <div id="content-display"></div>
    <a id="original-url"></a>
    <span id="page-title"></span>
  `;
};

const loadScript = () => {
  jest.resetModules();
  require('../public/script');
  document.dispatchEvent(new Event('DOMContentLoaded'));
};

describe('public/script.js', () => {
  beforeEach(() => {
    buildDom();
    global.fetch = jest.fn();
    loadScript();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows validation message when URL is missing', () => {
    const form = document.getElementById('url-form');
    const errorMessage = document.getElementById('error-message');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(errorMessage.classList.contains('hidden')).toBe(false);
    expect(errorMessage.textContent).toBe('Please enter a valid URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('renders fetched content and populates info when request succeeds', async () => {
    const url = 'https://example.com';
    const mockHtml = `<!DOCTYPE html><html><body><a href="https://www.yale.edu/about">About Yale</a></body></html>`;

    const originalCreateElement = document.createElement.bind(document);
    const links = [{ target: '', rel: '' }];

    const iframeDoc = {
      open: jest.fn(),
      write: jest.fn(),
      close: jest.fn(),
      body: {
        scrollHeight: 150,
        querySelectorAll: jest.fn().mockReturnValue(links)
      },
      querySelectorAll: jest.fn().mockReturnValue(links)
    };

    const createSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'iframe') {
          Object.defineProperty(element, 'contentDocument', { value: iframeDoc });
          Object.defineProperty(element, 'contentWindow', { value: { document: iframeDoc } });
        }
        return element;
      });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Fale Title',
        content: mockHtml
      })
    });

    const form = document.getElementById('url-form');
    const input = document.getElementById('url-input');
    input.value = url;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledWith('/fetch', expect.objectContaining({
      method: 'POST'
    }));

    const resultContainer = document.getElementById('result-container');
    const loading = document.getElementById('loading');
    const originalUrlElement = document.getElementById('original-url');
    const pageTitleElement = document.getElementById('page-title');
    const iframe = document.querySelector('iframe');

    expect(loading.classList.contains('hidden')).toBe(true);
    expect(resultContainer.classList.contains('hidden')).toBe(false);
    expect(originalUrlElement.textContent).toBe(url);
    expect(pageTitleElement.textContent).toBe('Fale Title');
    expect(iframe).not.toBeNull();

    iframe.onload && iframe.onload();
    expect(iframeDoc.querySelectorAll).toHaveBeenCalledWith('a');
    const [firstLink] = links;
    expect(firstLink.target).toBe('_blank');
    expect(firstLink.rel).toBe('noopener noreferrer');

    createSpy.mockRestore();
  });

  test('shows error message when fetch fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Bad URL' })
    });

    const form = document.getElementById('url-form');
    const input = document.getElementById('url-input');
    const errorMessage = document.getElementById('error-message');
    const resultContainer = document.getElementById('result-container');

    input.value = 'https://bad.example';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();

    expect(errorMessage.classList.contains('hidden')).toBe(false);
    expect(errorMessage.textContent).toBe('Bad URL');
    expect(resultContainer.classList.contains('hidden')).toBe(true);
  });
});
