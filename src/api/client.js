const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const HELPDESK_WHATSAPP = import.meta.env.VITE_HELPDESK_WHATSAPP || import.meta.env.VITE_SALESPERSON_WHATSAPP || '917623853955';
const SALESPERSON_WHATSAPP = import.meta.env.VITE_SALESPERSON_WHATSAPP || HELPDESK_WHATSAPP;
const AUTH_KEY = 'stockfinder_auth';


export function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch (error) {
    return null;
  }
}

export function getCurrentUser() {
  return getStoredAuth()?.user || null;
}

export function getAuthToken() {
  return getStoredAuth()?.token || '';
}

export function setStoredAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth || {}));
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export const PRODUCT_CATEGORIES = [
  { id: 'louvers', label: 'Louvers', companyName: 'Orange Profile (26-27)', categoryName: 'Louvers', hasBatches: true },
  { id: 'paintable', label: 'Paintable', companyName: 'Orange Profile (26-27)', categoryName: 'Paintable', hasBatches: false },
  { id: 'asa_sheet', label: 'ASA Sheet', companyName: 'Orange Profile (26-27)', categoryName: 'ASA Sheet', hasBatches: false },
  { id: 'laminate_sheet', label: 'Laminate Sheet', companyName: 'Best Moulding', categoryName: 'Laminate Sheet', hasBatches: false },
  { id: 'acrylic_sheet', label: 'Acrylic Sheet', companyName: 'Best Moulding', categoryName: 'Acrylic Sheet', hasBatches: false },
];

export function getCategoryById(id) {
  return PRODUCT_CATEGORIES.find((category) => category.id === id) || null;
}

function normalizeCode(code) {
  return String(code || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function getSessionId() {
  const key = 'tally_chat_session_id';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getSessionId(),
      ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `API error ${response.status}`);
  }

  return response.json();
}

async function postJson(path, payload) {
  return requestJson(path, {
    method: 'POST',
    body: JSON.stringify({ ...payload, sessionId: getSessionId() }),
  });
}


export async function loginUser({ username, password }) {
  const response = await requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (response?.token) setStoredAuth({ token: response.token, user: response.user });
  return response;
}

export async function fetchCurrentUser() {
  const response = await requestJson('/api/auth/me');
  if (response?.user) {
    setStoredAuth({ token: getAuthToken(), user: response.user });
  }
  return response;
}

export function logoutUser() {
  clearStoredAuth();
}

function adminHeaders(adminKey) {
  return { 'x-admin-key': String(adminKey || '') };
}

export async function listManagedUsers(adminKey) {
  return requestJson('/api/admin/users', { headers: adminHeaders(adminKey) });
}

export async function createManagedUser(adminKey, payload) {
  return requestJson('/api/admin/users', {
    method: 'POST',
    headers: adminHeaders(adminKey),
    body: JSON.stringify(payload),
  });
}

export async function updateManagedUser(adminKey, userId, payload) {
  return requestJson(`/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(adminKey),
    body: JSON.stringify(payload),
  });
}

export async function deactivateManagedUser(adminKey, userId) {
  return requestJson(`/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: adminHeaders(adminKey),
  });
}

let bulkCatalogCache = null;
let bulkCatalogPromise = null;

export function preloadBulkCatalog() {
  if (!bulkCatalogPromise) {
    bulkCatalogPromise = requestJson('/api/chat/bulk-catalog')
      .then((data) => {
        bulkCatalogCache = data;
        return data;
      })
      .catch((error) => {
        bulkCatalogPromise = null;
        throw error;
      });
  }
  return bulkCatalogPromise;
}

export async function getBulkCatalog() {
  if (bulkCatalogCache) return bulkCatalogCache;
  return preloadBulkCatalog();
}

export async function searchItems({ categoryId, categoryName, groupKey, query }) {
  return postJson('/api/chat/search-items', { categoryId, categoryName, groupKey, query });
}

export async function checkBulkStock(items) {
  return postJson('/api/chat/check-bulk-stock', { items });
}

export async function bookBulkOrder({ items = [], results = [], transportName = '' } = {}) {
  return postJson('/api/orders/bulk', { items, results, transportName });
}

function getPcsPerBox(productCode) {
  const code = normalizeCode(productCode).replace(/\s+/g, '');
  if (code.startsWith('LS')) return 30;
  if (code.startsWith('H')) return 20;
  if (code.startsWith('L')) return 16;
  if (code.startsWith('80')) return 12;
  return null;
}

function formatAvailable(stockQty, productCode, unit) {
  const qty = Number(stockQty || 0);
  const pcsPerBox = getPcsPerBox(productCode);
  if (unit === 'BOX' && pcsPerBox) {
    const boxes = Math.floor(qty / pcsPerBox);
    const remaining = qty % pcsPerBox;
    return remaining > 0 ? `${boxes} BOX + ${remaining} PCS` : `${boxes} BOX`;
  }
  return `${qty} PCS`;
}

function mockAvailability(productCode, requestedQty, requestedUnit) {
  const cleanCode = normalizeCode(productCode);
  const qty = Number(requestedQty);
  const unit = String(requestedUnit || '').toUpperCase();
  const pcsPerBox = getPcsPerBox(cleanCode);
  const requestedPcs = unit === 'BOX' && pcsPerBox ? qty * pcsPerBox : qty;
  const availableText = formatAvailable(0, cleanCode, unit);

  return {
    success: true,
    productCode: cleanCode,
    available: false,
    stockQty: 0,
    quantityText: '0 PCS',
    requestedQty: qty,
    requestedUnit: unit,
    requestedPcs,
    pcsPerBox,
    stockStatus: 'Out of Stock',
    responseMessage: `Backend not connected right now. Available Stock: ${availableText}`,
    isMock: true,
  };
}

export async function checkStock(productCode, context = {}) {
  const cleanCode = normalizeCode(productCode);

  try {
    return await postJson('/api/chat/check-stock', { productCode: cleanCode, ...context });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      success: true,
      productCode: cleanCode,
      available: false,
      quantityText: 'Backend not connected',
      stockStatus: 'Item Not Found',
      hasBatches: false,
      isMock: true,
    };
  }
}

export async function checkAvailability({ productCode, requestedQty, requestedUnit = 'PCS', companyName, categoryName, godownName, categoryId }) {
  const cleanCode = normalizeCode(productCode);
  const qty = Number(requestedQty);
  const unit = String(requestedUnit || 'PCS').toUpperCase();

  try {
    return await postJson('/api/chat/check-availability', {
      productCode: cleanCode,
      requestedQty: qty,
      requestedUnit: unit,
      companyName,
      categoryName,
      godownName,
      categoryId,
    });
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return mockAvailability(cleanCode, qty, unit);
  }
}

export async function checkStockBatches(stockOrCode) {
  const payload = typeof stockOrCode === 'object' && stockOrCode !== null
    ? {
      productCode: normalizeCode(stockOrCode.productCode),
      companyName: stockOrCode.companyName || '',
      categoryName: stockOrCode.categoryName || '',
      godownName: stockOrCode.godownName || '',
    }
    : { productCode: normalizeCode(stockOrCode) };

  try {
    return await postJson('/api/chat/check-stock-batches', payload);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      success: true,
      productCode: payload.productCode,
      godownName: payload.godownName || 'Rajkot Godown',
      totalBatches: 0,
      batches: [],
      isMock: true,
    };
  }
}

export function buildHelpDeskLink(productCode = '') {
  const text = productCode
    ? `Hello Help Desk, I need assistance with item code: ${normalizeCode(productCode)}.`
    : 'Hello Help Desk, I need assistance with stock inquiry.';

  return `https://wa.me/${HELPDESK_WHATSAPP}?text=${encodeURIComponent(text)}`;
}


function getWhatsAppNumberForUser(user = getCurrentUser()) {
  const digits = String(user?.salesPersonMobile || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits || SALESPERSON_WHATSAPP;
}

export function buildBulkOrderWhatsAppLink({ items = [], results = [], user = getCurrentUser(), transportName = '' } = {}) {
  const checkedMap = new Map(results.map((item) => [item.productCode, item]));
  const lines = [
    'New Bulk Stock / Order Request',
    '',
    `Client: ${user?.name || 'Client'}`,
    transportName ? `Transport: ${transportName}` : '',
    '',
    'Selected Items:',
  ];

  items.forEach((item, index) => {
    const checked = checkedMap.get(item.productCode);
    const status = checked ? (checked.available ? 'Available' : `Only ${checked.stockQty || 0} available`) : 'Not checked';
    lines.push(`${index + 1}. ${item.displayCode || item.productCode} - Required: ${item.requestedQty} PCS - ${status}`);
  });

  lines.push('', 'Please contact me for order confirmation.');

  return `https://wa.me/${getWhatsAppNumberForUser(user)}?text=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`;
}
