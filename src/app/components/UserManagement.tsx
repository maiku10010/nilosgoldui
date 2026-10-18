import { useEffect, useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { PageHeader } from './PageHeader';

type User = { empId: string; empName: string; userName: string; empRole: string; deletedAt: string | null; lastLoginAt: string | null; mustChangePassword: boolean };
const inputClass = 'mt-1 w-full rounded-md border border-border bg-background p-2 text-sm';
export async function accountRequest(base: string, path: string, body?: unknown, method = 'POST') {
  const response = await fetch(base + path, { credentials: 'include', method: body === undefined && method === 'POST' ? 'GET' : method, headers: { 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'The request could not be completed.');
  return data;
}
export function PasswordPage({ base, forced = false, onChanged, onCancel }: { base: string; forced?: boolean; onChanged: (user: any) => void; onCancel: () => void }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (newPassword !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try { const data = await accountRequest(base, '/auth/change-password', { newPassword, ...(!forced ? { currentPassword } : {}) }); setCurrent(''); setPassword(''); setConfirmation(''); onChanged(data.user); }
    catch (error) { setError(error instanceof Error ? error.message : 'Password could not be changed.'); }
    finally { setBusy(false); }
  };
  return <section className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6">
    <h1 className="text-xl font-semibold">{forced ? 'Set your password' : 'Change password'}</h1>
    <p className="my-3 text-sm text-muted-foreground">{forced ? 'Choose a new password before continuing. Your temporary password has been used.' : 'Changing your password signs out your other sessions.'} Use at least 12 characters.</p>
    <form onSubmit={submit} className="space-y-4">
      {!forced && <label className="block text-sm">Current password<input required type="password" autoComplete="current-password" className={inputClass} value={currentPassword} onChange={event => setCurrent(event.target.value)} /></label>}
      <label className="block text-sm">New password<input required minLength={12} maxLength={72} type="password" autoComplete="new-password" className={inputClass} value={newPassword} onChange={event => setPassword(event.target.value)} /></label>
      <label className="block text-sm">Confirm new password<input required type="password" autoComplete="new-password" className={inputClass} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{forced ? 'Sign out' : 'Cancel'}</Button><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</Button></div>
    </form>
  </section>;
}
export function UsersPage({ base, actorId }: { base: string; actorId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Staff');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ temporaryPassword: string; expiresAt: string; user: User } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<{ user: User; action: 'reset' | 'status' | 'role'; role?: string } | null>(null);
  const load = async () => { setLoading(true); try { setUsers(await accountRequest(base, '/users')); } catch (error) { setError((error as Error).message); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [base]);
  const create = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await accountRequest(base, '/users', { empName: name, userName: username, empRole: role }); setCreating(false); setName(''); setUsername(''); setRole('Staff'); setCopied(false); setSecret(result); await load(); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (!pending) return;
    setBusy(true); setError('');
    try {
      const path = '/users/' + encodeURIComponent(pending.user.empId);
      if (pending.action === 'reset') { const result = await accountRequest(base, path + '/reset-password', {}); setCopied(false); setSecret(result); }
      else await accountRequest(base, path, pending.action === 'role' ? { empRole: pending.role } : { active: Boolean(pending.user.deletedAt) }, 'PATCH');
      setPending(null); await load();
    } catch (error) { setPending(null); setError((error as Error).message); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <PageHeader title="Users" description="Manage accounts, roles, and access. Deactivated users remain in audit history." action={<Button variant="primary" onClick={() => { setError(''); setCreating(true); }}>Create user</Button>} />
    {error && <p role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</p>}
    <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-left text-sm"><thead><tr>{['Name', 'Username', 'Role', 'Status', 'Last login', 'Actions'].map(label => <th key={label} scope="col" className="p-4">{label}</th>)}</tr></thead><tbody>
      {users.map(user => <tr key={user.empId} className="border-t border-border">
        <td className="p-4">{user.empName}{user.empId === actorId && <span className="text-muted-foreground"> (you)</span>}</td><td className="p-4">{user.userName}</td>
        <td className="p-4"><select aria-label={`Role for ${user.userName}`} className={inputClass} value={user.empRole} disabled={busy || user.empId === actorId} onChange={event => setPending({ user, action: 'role', role: event.target.value })}><option>Admin</option><option>Staff</option></select></td>
        <td className="p-4">{user.deletedAt ? 'Deactivated' : 'Active'}{!user.deletedAt && user.mustChangePassword && <span className="block text-xs text-muted-foreground">Password setup required</span>}</td>
        <td className="p-4">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td>
        <td className="p-4"><div className="flex gap-2"><Button variant="secondary" disabled={busy || Boolean(user.deletedAt)} onClick={() => setPending({ user, action: 'reset' })}>Reset password</Button><Button variant="secondary" disabled={busy || user.empId === actorId} onClick={() => setPending({ user, action: 'status' })}>{user.deletedAt ? 'Reactivate' : 'Deactivate'}</Button></div></td>
      </tr>)}
      {!users.length && <tr><td className="p-6 text-muted-foreground" colSpan={6}>{loading ? 'Loading users…' : 'No users found.'}</td></tr>}
    </tbody></table></div>
    <Dialog open={creating} onOpenChange={open => { if (!busy) setCreating(open); }}><DialogContent><DialogHeader><DialogTitle>Create user</DialogTitle><DialogDescription>A temporary password will be generated and shown once. It expires in 24 hours.</DialogDescription></DialogHeader>
      <form onSubmit={create} className="space-y-4"><label className="block text-sm">Name<input autoFocus required maxLength={100} className={inputClass} value={name} onChange={event => setName(event.target.value)} /></label><label className="block text-sm">Username<input required pattern="[a-zA-Z0-9._-]{3,100}" minLength={3} maxLength={100} className={inputClass} value={username} onChange={event => setUsername(event.target.value)} /><span className="text-xs text-muted-foreground">3–100 letters, numbers, dots, underscores or hyphens.</span></label><label className="block text-sm">Role<select className={inputClass} value={role} onChange={event => setRole(event.target.value)}><option>Staff</option><option>Admin</option></select></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<Button variant="primary" disabled={busy} type="submit">{busy ? 'Creating…' : 'Create user'}</Button></form>
    </DialogContent></Dialog>
    <Dialog open={Boolean(pending)} onOpenChange={open => { if (!open && !busy) setPending(null); }}><DialogContent><DialogHeader><DialogTitle>{pending?.action === 'reset' ? 'Reset password' : pending?.action === 'role' ? 'Change role' : pending?.user.deletedAt ? 'Reactivate user' : 'Deactivate user'}</DialogTitle><DialogDescription>{pending?.user.empName} ({pending?.user.userName}). {pending?.action === 'reset' ? 'This replaces their password and signs out all their sessions.' : pending?.action === 'role' ? `Change their role to ${pending.role}? Their sessions will end.` : pending?.user.deletedAt ? 'Restore access to this account?' : 'Their sessions will end immediately. Their name and audit history will be retained.'}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>Cancel</Button><Button variant="primary" disabled={busy} onClick={apply}>{busy ? 'Saving…' : 'Confirm'}</Button></div></DialogContent></Dialog>
    <Dialog open={Boolean(secret)} onOpenChange={open => { if (!open) { setSecret(null); setCopied(false); } }}><DialogContent><DialogHeader><DialogTitle>Copy temporary password</DialogTitle><DialogDescription>For {secret?.user.userName}. This password is shown only once. Copy it before closing. It expires {secret ? new Date(secret.expiresAt).toLocaleString() : ''} and can be used for one login.</DialogDescription></DialogHeader><input aria-label="Temporary password" readOnly autoComplete="off" className={inputClass + ' font-mono'} value={secret?.temporaryPassword ?? ''} onFocus={event => event.target.select()} /><p role="status" className="text-sm text-muted-foreground">{copied ? 'Copied to clipboard.' : 'Share it securely with the user. They must set a new password.'}</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(secret?.temporaryPassword ?? ''); setCopied(true); } catch { setError('Select the temporary password and copy it manually.'); } }}>Copy password</Button><Button variant="primary" onClick={() => { setSecret(null); setCopied(false); }}>Done</Button></div></DialogContent></Dialog>
  </div>;
}
