import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Clock, Users, UserPlus, Timer, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  name: string;
  email: string;
  markedAt: Date;
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
  const [currentUser, setCurrentUser] = useState(null);
  const [secondName, setSecondName] = useState('');
  const [showSecondNameInput, setShowSecondNameInput] = useState(false);
  const [hasMarkedSelf, setHasMarkedSelf] = useState(false);
  const { toast } = useToast();

  // Load users from Supabase
  useEffect(() => {
    const loadUsers = async () => {
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
    };

    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };

    loadUsers();
    getCurrentUser();
  }, []);

  // Timer effect
  useEffect(() => {
    if (currentTurnIndex < userQueue.length && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0) {
      // Time expired, move to next user
      setCurrentTurnIndex(prev => prev + 1);
      setTimeRemaining(60);
      toast({
        title: "Tempo esgotado!",
        description: "Passando para o próximo jogador.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, currentTurnIndex, userQueue.length, toast]);

  const isMyTurn = () => {
    return userQueue[currentTurnIndex]?.id === currentUser?.id;
  };

  const canMarkName = () => {
    return isMyTurn() && timeRemaining > 0;
  };

  const markMyName = () => {
    if (!canMarkName()) {
      toast({
        title: "Aguarde sua vez!",
        description: "Você só pode marcar quando for sua vez.",
        variant: "destructive",
      });
      return;
    }

    const currentPlayer = userQueue[currentTurnIndex];
    const newPlayer: Player = {
      id: `player_${Date.now()}`,
      name: currentPlayer.name,
      email: currentPlayer.email,
      markedAt: new Date(),
    };

    if (confirmedPlayers.length < 12) {
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
  };

  const markSecondName = () => {
    if (!secondName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome da segunda pessoa.",
        variant: "destructive",
      });
      return;
    }

    const newPlayer: Player = {
      id: `player_${Date.now()}_second`,
      name: secondName.trim(),
      email: '',
      markedAt: new Date(),
    };

    if (confirmedPlayers.length < 12) {
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
    setCurrentTurnIndex(prev => prev + 1);
    setTimeRemaining(60);
  };

  const skipSecondName = () => {
    // Reset state and move to next player's turn
    setSecondName('');
    setShowSecondNameInput(false);
    setHasMarkedSelf(false);
    setCurrentTurnIndex(prev => prev + 1);
    setTimeRemaining(60);
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
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          🏐 Quadra de Vôlei
        </h1>
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
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {player.markedAt.toLocaleTimeString()}
                  </span>
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
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {player.markedAt.toLocaleTimeString()}
                  </span>
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
            {userQueue.map((user, index) => (
              <div 
                key={user.id}
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
                  <span className={`font-medium ${user.id === currentUser?.id ? 'text-primary' : ''}`}>
                    {user.name} {user.id === currentUser?.id && '(Você)'}
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