import { Link } from "react-router-dom";
import { ArrowLeft, Clapperboard, PlusSquare } from "lucide-react";
import { useFeed } from "@/hooks/usePosts";
import { PostCard } from "@/components/social/PostCard";

const Reels = () => {
  const { posts, loading, refetch } = useFeed("reels");
  const videos = posts;

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border/50 bg-card/90 px-4 py-3">
        <Link to="/" aria-label="Back to Feed" className="p-2 text-muted-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex items-center gap-2"><Clapperboard className="h-5 w-5 text-primary" /><h1 className="font-bold text-foreground">Tiger Reels</h1></div>
        <Link to="/reels/studio" aria-label="Create video" className="p-2 text-primary"><PlusSquare className="h-5 w-5" /></Link>
      </header>
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory">
        {loading ? <div className="py-20 text-center text-sm text-muted-foreground">Loading videos…</div> : videos.length ? (
          videos.map((post) => <section key={post.id} className="min-h-[calc(100dvh-8.5rem)] snap-start flex items-center justify-center border-b border-border/50"><div className="w-full max-w-xl"><PostCard post={post} onChanged={refetch} isReel /></div></section>)
        ) : (
          <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-24 text-center"><Clapperboard className="mb-4 h-12 w-12 text-muted-foreground" /><h2 className="font-semibold text-foreground">No Reels yet</h2><p className="mt-2 text-sm text-muted-foreground">Share a video to start the Tiger Reels feed.</p><Link to="/reels/studio" className="mt-5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Create video</Link></div>
        )}
      </div>
    </div>
  );
};

export default Reels;
