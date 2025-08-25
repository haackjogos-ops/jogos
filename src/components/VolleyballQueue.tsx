import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Users, UserPlus, Timer, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  name: string;
  email: string;
  markedAt: Date;
  position: number;
  isWaiting: boolean;
  skillLevel: 'iniciante' | 'intermediario' | 'avancado';
  markedByUserId: string;
}

interface QueueUser {
  id: string;
  name: string;
  email: string;
  joinedAt: Date;
}

const VolleyballQueue = () => {
  const [confirmedPlayers, setConfirmedPlayers] = useState<Player[]>([]);
  const [waitingList, setWaitingList] = useState<Player[]>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [userQueue, setUserQueue] = useState<QueueUser[]>([]);
  const [secondName, setSecondName] = useState('');
  const [showSecondNameInput, setShowSecondNameInput] = useState(false);
  const [hasMarkedSelf, setHasMarkedSelf] = useState(false);
  const [skillLevel, setSkillLevel] = useState<'iniciante' | 'intermediario' | 'avancado'>('iniciante');
  const [secondSkillLevel, setSecondSkillLevel] = useState<'iniciante' | 'intermediario' | 'avancado'>('iniciante');
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Load users and queue entries from Supabase
  useEffect(() => {
    const loadData = async () => {
      // Load users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .order('created_at');
      
      if (profiles) {
        const queueUsers = profiles.map(profile => ({
          id: profile.user_id,
          name: profile.display_name || 'Usuário',
          email: '',
          joinedAt: new Date()
        }));
        setUserQueue(queueUsers);
      }

      // Load current queue entries
      const { data: queueEntries } = await supabase
        .from('volleyball_queue')
        .select('*')
        .order('position');

      if (queueEntries) {
        const confirmed = queueEntries
          .filter(entry => !entry.is_waiting)
          .map(entry => ({
            id: entry.id,
            name: entry.player_name,
            email: '',
            markedAt: new Date(entry.marked_at),
            position: entry.position,
            isWaiting: entry.is_waiting,
            skillLevel: entry.skill_level as 'iniciante' | 'intermediario' | 'avancado',
            markedByUserId: entry.marked_by_user_id
          }));

        const waiting = queueEntries
          .filter(entry => entry.is_waiting)
          .map(entry => ({
            id: entry.id,
            name: entry.player_name,
            email: '',
            markedAt: new Date(entry.marked_at),
            position: entry.position,
            isWaiting: entry.is_waiting,
            skillLevel: entry.skill_level as 'iniciante' | 'intermediario' | 'avancado',
            markedByUserId: entry.marked_by_user_id
          }));

        setConfirmedPlayers(confirmed);
        setWaitingList(waiting);
      }

      // Load queue state
      const { data: queueStateData } = await supabase
        .from('queue_state')
        .select('*')
        .limit(1)
        .single();

      if (queueStateData) {
        setCurrentTurnIndex(queueStateData.current_turn_index);
        setTimeRemaining(queueStateData.time_remaining);
      }
    };

    loadData();
  }, []);

  // Timer effect
  useEffect(() => {
    if (currentTurnIndex < userQueue.length && timeRemaining > 0) {
      const timer = setTimeout(async () => {
        const newTime = timeRemaining - 1;
        setTimeRemaining(newTime);
        // Save time every 10 seconds to avoid too many updates
        if (newTime % 10 === 0) {
          await updateQueueState(currentTurnIndex, newTime);
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      // Time expired, move to next user
      const newIndex = currentTurnIndex + 1;
      setCurrentTurnIndex(newIndex);
      setTimeRemaining(60);
      updateQueueState(newIndex, 60);
      toast({
        title: "Tempo esgotado!",
        description: "Passando para o próximo jogador.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, currentTurnIndex, userQueue.length, toast]);

  const isMyTurn = () => {
    return userQueue[currentTurnIndex]?.id === user?.id;
  };

  const canMarkName = () => {
    return isMyTurn() && timeRemaining > 0;
  };

  const markMyName = async () => {
    if (!canMarkName()) {
      toast({
        title: "Aguarde sua vez!",
        description: "Você só pode marcar quando for sua vez.",
        variant: "destructive",
      });
      return;
    }

    const currentPlayer = userQueue[currentTurnIndex];
    const isWaiting = confirmedPlayers.length >= 12;
    const position = isWaiting ? waitingList.length + 1 : confirmedPlayers.length + 1;

    try {
      // Save to database
      const { data, error } = await supabase
        .from('volleyball_queue')
        .insert({
          player_name: currentPlayer.name,
          marked_by_user_id: user?.id,
          position: position,
          is_waiting: isWaiting,
          skill_level: skillLevel
        })
        .select()
        .single();

      if (error) throw error;

      const newPlayer: Player = {
        id: data.id,
        name: currentPlayer.name,
        email: currentPlayer.email,
        markedAt: new Date(data.marked_at),
        position: data.position,
        isWaiting: data.is_waiting,
        skillLevel: data.skill_level as 'iniciante' | 'intermediario' | 'avancado',
        markedByUserId: data.marked_by_user_id
      };

      if (!isWaiting) {
        setConfirmedPlayers(prev => [...prev, newPlayer]);
      } else {
        setWaitingList(prev => [...prev, newPlayer]);
      }

      setHasMarkedSelf(true);
      setShowSecondNameInput(true);

      toast({
        title: "Nome marcado!",
        description: `${currentPlayer.name} foi adicionado à lista.`,
      });
    } catch (error) {
      console.error('Erro ao marcar nome:', error);
      toast({
        title: "Erro ao marcar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const markSecondName = async () => {
    if (!secondName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome da segunda pessoa.",
        variant: "destructive",
      });
      return;
    }

    const isWaiting = confirmedPlayers.length >= 12;
    const position = isWaiting ? waitingList.length + 1 : confirmedPlayers.length + 1;

    try {
      // Save to database
      const { data, error } = await supabase
        .from('volleyball_queue')
        .insert({
          player_name: secondName.trim(),
          marked_by_user_id: user?.id,
          position: position,
          is_waiting: isWaiting,
          skill_level: secondSkillLevel
        })
        .select()
        .single();

      if (error) throw error;

      const newPlayer: Player = {
        id: data.id,
        name: secondName.trim(),
        email: '',
        markedAt: new Date(data.marked_at),
        position: data.position,
        isWaiting: data.is_waiting,
        skillLevel: data.skill_level as 'iniciante' | 'intermediario' | 'avancado',
        markedByUserId: data.marked_by_user_id
      };

      if (!isWaiting) {
        setConfirmedPlayers(prev => [...prev, newPlayer]);
      } else {
        setWaitingList(prev => [...prev, newPlayer]);
      }

      toast({
        title: "Segundo nome marcado!",
        description: `${secondName} foi adicionado à lista.`,
      });

      // Reset state and move to next player's turn
      setSecondName('');
      setShowSecondNameInput(false);
      setHasMarkedSelf(false);
      setSkillLevel('iniciante');
      setSecondSkillLevel('iniciante');
      const newIndex = currentTurnIndex + 1;
      setCurrentTurnIndex(newIndex);
      setTimeRemaining(60);
      await updateQueueState(newIndex, 60);
    } catch (error) {
      console.error('Erro ao marcar segundo nome:', error);
      toast({
        title: "Erro ao marcar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const deletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('volleyball_queue')
        .delete()
        .eq('id', playerId);

      if (error) {
        toast({
          title: "Erro ao excluir",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setConfirmedPlayers(prev => prev.filter(p => p.id !== playerId));
      setWaitingList(prev => prev.filter(p => p.id !== playerId));

      toast({
        title: "Marcação excluída",
        description: "Sua marcação foi removida da lista.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const updateQueueState = async (turnIndex: number, timeLeft: number) => {
    try {
      await supabase
        .from('queue_state')
        .update({
          current_turn_index: turnIndex,
          time_remaining: timeLeft
        })
        .limit(1);
    } catch (error) {
      console.error('Erro ao salvar estado da fila:', error);
    }
  };

  const skipSecondName = async () => {
    // Reset state and move to next player's turn
    setSecondName('');
    setShowSecondNameInput(false);
    setHasMarkedSelf(false);
    setSkillLevel('iniciante');
    setSecondSkillLevel('iniciante');
    const newIndex = currentTurnIndex + 1;
    setCurrentTurnIndex(newIndex);
    setTimeRemaining(60);
    await updateQueueState(newIndex, 60);
  };

  const getSkillLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'iniciante':
        return 'bg-green-100 text-green-800';
      case 'intermediario':
        return 'bg-yellow-100 text-yellow-800';
      case 'avancado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentPlayer = userQueue[currentTurnIndex];
  const spotsRemaining = Math.max(0, 12 - confirmedPlayers.length);

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            🏐 Quadra de Vôlei
          </h1>
          <div className="flex gap-2">
            {user?.email === 'ptairone@hotmail.com' && (
              <Button onClick={() => navigate('/admin')} variant="outline" size="sm">
                Admin
              </Button>
            )}
            <Button onClick={signOut} variant="outline" size="sm">
              Sair
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">Sistema de marcação em fila</p>
      </div>

      {/* Current Turn Card */}
      <Card className="shadow-sport">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Timer className="h-5 w-5" />
            Vez Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {currentPlayer ? (
            <>
              <div className="space-y-2">
                <p className="text-lg font-semibold">{currentPlayer.name}</p>
                <Badge variant={isMyTurn() ? "default" : "secondary"} className="text-sm">
                  {isMyTurn() ? "SUA VEZ!" : "Aguarde..."}
                </Badge>
              </div>
              
              <div className={`text-3xl font-bold ${timeRemaining <= 10 ? 'text-warning animate-pulse-sport' : 'text-primary'}`}>
                <Clock className="inline h-6 w-6 mr-2" />
                {formatTime(timeRemaining)}
              </div>

              {isMyTurn() && !showSecondNameInput && (
                <div className="space-y-3">
                  <Select value={skillLevel} onValueChange={(value: 'iniciante' | 'intermediario' | 'avancado') => setSkillLevel(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione seu nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={markMyName} 
                    variant="sport" 
                    size="lg"
                    disabled={!canMarkName() || hasMarkedSelf}
                    className="w-full"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Marcar Meu Nome
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Você pode marcar até 2 nomes em {formatTime(timeRemaining)}
                  </p>
                </div>
              )}

              {isMyTurn() && showSecondNameInput && (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome da segunda pessoa"
                    value={secondName}
                    onChange={(e) => setSecondName(e.target.value)}
                    className="w-full"
                  />
                  
                  <Select value={secondSkillLevel} onValueChange={(value: 'iniciante' | 'intermediario' | 'avancado') => setSecondSkillLevel(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nível da segunda pessoa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={markSecondName} 
                      variant="sport" 
                      size="lg"
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Marcar
                    </Button>
                    <Button 
                      onClick={skipSecondName} 
                      variant="outline" 
                      size="lg"
                      className="flex-1"
                    >
                      Pular
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tempo restante: {formatTime(timeRemaining)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Todos os jogadores já marcaram!</p>
          )}
        </CardContent>
      </Card>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <Users className="h-8 w-8 mx-auto text-accent" />
              <p className="text-2xl font-bold text-accent">{confirmedPlayers.length}/12</p>
              <p className="text-sm text-muted-foreground">Confirmados</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-card">
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <Clock className="h-8 w-8 mx-auto text-primary" />
              <p className="text-2xl font-bold text-primary">{spotsRemaining}</p>
              <p className="text-sm text-muted-foreground">Vagas Restantes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmed Players List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Jogadores Confirmados ({confirmedPlayers.length}/12)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {confirmedPlayers.length > 0 ? (
            <div className="grid gap-2">
              {confirmedPlayers.map((player, index) => (
                <div 
                  key={player.id} 
                  className="flex items-center justify-between p-3 bg-accent/10 rounded-lg border-l-4 border-accent"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="font-medium">{player.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getSkillLevelBadgeColor(player.skillLevel)}`}>
                        {player.skillLevel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {player.markedAt.toLocaleTimeString()}
                    </span>
                    {player.markedByUserId === user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePlayer(player.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum jogador confirmado ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Waiting List */}
      {waitingList.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Lista de Espera ({waitingList.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {waitingList.map((player, index) => (
                <div 
                  key={player.id} 
                  className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border-l-4 border-warning"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="font-medium">{player.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getSkillLevelBadgeColor(player.skillLevel)}`}>
                        {player.skillLevel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {player.markedAt.toLocaleTimeString()}
                    </span>
                    {player.markedByUserId === user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deletePlayer(player.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Status */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Ordem da Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {userQueue.map((queueUser, index) => (
              <div 
                key={queueUser.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === currentTurnIndex 
                    ? 'bg-primary/10 border-l-4 border-primary' 
                    : index < currentTurnIndex 
                      ? 'bg-muted/50 opacity-60' 
                      : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={index === currentTurnIndex ? "default" : "outline"} 
                    className="text-xs"
                  >
                    {index + 1}
                  </Badge>
                  <span className={`font-medium ${queueUser.id === user?.id ? 'text-primary' : ''}`}>
                    {queueUser.name} {queueUser.id === user?.id && '(Você)'}
                  </span>
                </div>
                {index === currentTurnIndex && (
                  <Badge variant="default" className="animate-bounce-soft">
                    Ativo
                  </Badge>
                )}
                {index < currentTurnIndex && (
                  <Badge variant="outline" className="text-accent">
                    Concluído
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VolleyballQueue;