import { GameBoyScreen } from '@/components/GameBoyScreen';
import { getAllGames, getGameBySlug } from '@/games/registry';
import { notFound } from 'next/navigation';

interface GamePageProps {
  params: { slug: string };
  searchParams: { code?: string };
}

export function generateStaticParams() {
  return getAllGames().map((g) => ({ slug: g.slug }));
}

export default function GamePage({ params, searchParams }: GamePageProps) {
  const game = getGameBySlug(params.slug);
  if (!game) notFound();

  return <GameBoyScreen gameSlug={params.slug} saveCode={searchParams.code} />;
}
