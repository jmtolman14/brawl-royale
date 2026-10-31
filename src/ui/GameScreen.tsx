import { lazy, Suspense, useEffect } from 'react';
import { toggleLock } from '../game/GameLoop';
import { session, startMatch } from '../game/session';
import { useUi } from '../store/ui';

const GameCanvas = lazy(() => import('../render/GameCanvas'));

export default function GameScreen() {
  const { fighterId, training, matchKey } = useUi();
  // Create the match synchronously before the canvas mounts
  if (!session.runner || (session.runner as unknown as { key?: number }).key !== matchKey) {
    const r = startMatch({ seed: (Date.now() & 0xffff) + matchKey, playerRoster: fighterId, botCount: training ? 1 : 29, skipBus: training, training });
    (r as unknown as { key?: number }).key = matchKey;
  }
  useEffect(() => {
    const ui = useUi.getState();
    session.input.ui = {
      onMap: () => ui.set({ mapOpen: !useUi.getState().mapOpen }),
      onPause: () => useUi.getState().set({ paused: !useUi.getState().paused }),
      onLock: toggleLock,
    };
    return () => {
      session.input.detach();
    };
  }, []);
  return (
    <div className="fixed inset-0">
      <Suspense fallback={<div className="grid h-full place-items-center font-display text-4xl">LOADING ISLAND…</div>}>
        <GameCanvas key={matchKey} />
      </Suspense>
    </div>
  );
}
