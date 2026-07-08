import { normalizeRole } from './authUtils';

const BLOCK_KEY = 'zz_staff_login_blocklist';

export function getBlockedStaffEmails() {
  try {
    const raw = localStorage.getItem(BLOCK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map((e) => String(e).toLowerCase().trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function addBlockedStaffEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return;
  const list = getBlockedStaffEmails();
  if (!list.includes(e)) {
    list.push(e);
    localStorage.setItem(BLOCK_KEY, JSON.stringify(list));
  }
}

export function removeBlockedStaffEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  const list = getBlockedStaffEmails().filter((x) => x !== e);
  localStorage.setItem(BLOCK_KEY, JSON.stringify(list));
}

/** True → login must be refused (clear token). */
export function shouldDenyStaffLogin(user) {
  if (!user || typeof user !== 'object') return false;
  const role = normalizeRole(user.role);
  if (role !== 'staff') return false;

  const email = String(user.email || '').trim().toLowerCase();
  if (email && getBlockedStaffEmails().includes(email)) return true;

  const rs = String(user.recruitment_status || user.application_status || user.staff_review_status || '').toLowerCase();
  if (['rejected', 'not_selected', 'not selected', 'notselected', 'inactive', 'denied', 'deny'].includes(rs)) return true;

  const st = String(user.status || user.account_status || '').toLowerCase();
  if (['inactive', 'disabled', 'blocked', 'suspended'].includes(st)) return true;

  const activeFlag = user.is_active ?? user.active;
  if (activeFlag === false || activeFlag === 0) return true;

  return false;
}
