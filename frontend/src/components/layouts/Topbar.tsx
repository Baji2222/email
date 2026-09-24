import { useAuth } from '@/hooks/useAuth';

export function Topbar() {
  const { session, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="text-sm text-gray-500">Admin Console</div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">{session?.user.email}</span>
        <button
          onClick={() => void signOut()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
