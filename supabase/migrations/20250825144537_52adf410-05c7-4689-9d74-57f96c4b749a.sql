-- Create table for volleyball queue entries
CREATE TABLE public.volleyball_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name text NOT NULL,
  marked_by_user_id uuid REFERENCES auth.users(id),
  position integer NOT NULL,
  is_waiting boolean NOT NULL DEFAULT false,
  marked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.volleyball_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for volleyball queue
CREATE POLICY "Volleyball queue is viewable by everyone" 
ON public.volleyball_queue 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert into volleyball queue" 
ON public.volleyball_queue 
FOR INSERT 
WITH CHECK (auth.uid() = marked_by_user_id);

CREATE POLICY "Users can update their own queue entries" 
ON public.volleyball_queue 
FOR UPDATE 
USING (auth.uid() = marked_by_user_id);

CREATE POLICY "Users can delete their own queue entries" 
ON public.volleyball_queue 
FOR DELETE 
USING (auth.uid() = marked_by_user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_volleyball_queue_updated_at
BEFORE UPDATE ON public.volleyball_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();