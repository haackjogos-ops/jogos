-- Create a table to store queue state
CREATE TABLE public.queue_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  time_remaining INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.queue_state ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Queue state is viewable by everyone" 
ON public.queue_state 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can update queue state" 
ON public.queue_state 
FOR UPDATE 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can insert queue state" 
ON public.queue_state 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

-- Add trigger for timestamps
CREATE TRIGGER update_queue_state_updated_at
BEFORE UPDATE ON public.queue_state
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial state
INSERT INTO public.queue_state (current_turn_index, time_remaining) VALUES (0, 60);