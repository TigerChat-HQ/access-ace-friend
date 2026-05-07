
-- Call signals table for WebRTC signaling
CREATE TABLE public.call_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'hangup', 'reject')),
  signal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own call signals"
ON public.call_signals FOR SELECT
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can create call signals"
ON public.call_signals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can update their own call signals"
ON public.call_signals FOR UPDATE
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can delete their own call signals"
ON public.call_signals FOR DELETE
TO authenticated
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Enable realtime for instant signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Index for fast lookups
CREATE INDEX idx_call_signals_callee ON public.call_signals(callee_id, status);
CREATE INDEX idx_call_signals_caller ON public.call_signals(caller_id, status);
