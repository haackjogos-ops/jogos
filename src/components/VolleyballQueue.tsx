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

interface ActiveFila {
  id: string;
  usuario_id: string;
  nome_usuario: string;
  ordem: number;
  iniciou_em: string | null;
  concluiu_em: string | null;
  status: 'pendente' | 'ativo' | 'finalizado';
  remaining_seconds: number | null;
  was_advanced?: boolean;
}

interface FilaUser {
  id: string;
  usuario_id: string;
  nome_usuario: string;
  ordem: number;
  status: 'pendente' | 'ativo' | 'finalizado';
}

const VolleyballQueue = () => {
  const [confirmedPlayers, setConfirmedPlayers] = useState<Player[]>([]);
  const [waitingList, setWaitingList] = useState<Player[]>([]);
  const [activeFila, setActiveFila] = useState<ActiveFila | null>(null);
  const [filaUsers, setFilaUsers] = useState<FilaUser[]>([]);
  const [firstPlayerName, setFirstPlayerName] = useState('');
  const [secondPlayerName, setSecondPlayerName] = useState('');
  const [firstSkillLevel, setFirstSkillLevel] = useState<'iniciante' | 'intermediario' | 'avancado'>('iniciante');
  const [secondSkillLevel, setSecondSkillLevel] = useState<'iniciante' | 'intermediario' | 'avancado'>('iniciante');
  const [marksCount, setMarksCount] = useState(0);
  const [dynamicTimeRemaining, setDynamicTimeRemaining] = useState(0);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Send heartbeat every 15 seconds
  useEffect(() => {
    if (!user?.id) return;

    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('update_user_heartbeat');
      } catch (error) {
        console.error('Erro ao enviar heartbeat:', error);
      }
    };

    // Send immediately
    sendHeartbeat();

    // Then every 15 seconds
    const heartbeatInterval = setInterval(sendHeartbeat, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [user?.id]);

  // Initialize fila and load data
  useEffect(() => {
    const initializeAndLoadData = async () => {
      try {
        await supabase.rpc('initialize_fila_if_empty');
        await loadFilaData();
        await loadVolleyballQueue();
      } catch (error) {
        console.error('Erro ao inicializar dados:', error);
      }
    };

    initializeAndLoadData();
  }, []);

  // Dynamic timer - recalculate based on iniciou_em every second
  useEffect(() => {
    const updateTimer = () => {
      if (activeFila?.iniciou_em) {
        const startTime = new Date(activeFila.iniciou_em).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsedSeconds);
        setDynamicTimeRemaining(remaining);
      } else {
        setDynamicTimeRemaining(0);
      }
    };

    updateTimer(); // Calculate immediately
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [activeFila?.iniciou_em]);

  // Advance fila and refresh every second
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        const { data: advanced } = await supabase.rpc('advance_fila_with_offline_check');
        if (advanced && advanced.length > 0) {
          setActiveFila(advanced[0]);
        }
        await loadFilaData();
        await loadVolleyballQueue();
      } catch (e) {
        console.error('Erro ao avançar/atualizar fila:', e);
      }
    }, 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  const loadFilaData = async () => {
    try {
      // Load all fila users
      const { data: filaData } = await supabase
        .from('fila')
        .select('*')
        .order('ordem');
      
      if (filaData) {
        setFilaUsers(filaData);
      }

      // Load active fila
      const { data: activeFilaData } = await supabase.rpc('get_active_fila');
      if (activeFilaData && activeFilaData.length > 0) {
        setActiveFila(activeFilaData[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados da fila:', error);
    }
  };

  const loadVolleyballQueue = async () => {
    try {
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

        // Count marks for current user in this turn
        if (activeFila && activeFila.iniciou_em) {
          const userMarks = queueEntries.filter(entry => 
            entry.marked_by_user_id === user?.id &&
            new Date(entry.marked_at) >= new Date(activeFila.iniciou_em!)
          );
          setMarksCount(userMarks.length);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar fila de volei:', error);
    }
  };

  const isMyTurn = () => {
    return activeFila?.usuario_id === user?.id;
  };

  const canMarkNames = () => {
    return isMyTurn() && dynamicTimeRemaining > 0 && marksCount < 2;
  };

  const markFirstName = async () => {
    if (!firstPlayerName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite seu nome para marcar.",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabase.rpc('add_volleyball_mark', {
        player_name: firstPlayerName.trim(),
        skill_level: firstSkillLevel
      });

      toast({
        title: "Nome marcado!",
        description: `${firstPlayerName} foi adicionado à lista.`,
      });

      setFirstPlayerName('');
      setMarksCount(prev => prev + 1);
      await loadVolleyballQueue();
    } catch (error: any) {
      toast({
        title: "Erro ao marcar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const markSecondName = async () => {
    if (!secondPlayerName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite o nome da segunda pessoa.",
        variant: "destructive",
      });
      return;
    }

    try {
      await supabase.rpc('add_volleyball_mark', {
        player_name: secondPlayerName.trim(),
        skill_level: secondSkillLevel
      });

      toast({
        title: "Segundo nome marcado!",
        description: `${secondPlayerName} foi adicionado à lista.`,
      });

      setSecondPlayerName('');
      setMarksCount(prev => prev + 1);
      await loadVolleyballQueue();
    } catch (error: any) {
      toast({
        title: "Erro ao marcar",
        description: error.message || "Tente novamente.",
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

      toast({
        title: "Marcação excluída",
        description: "Sua marcação foi removida da lista.",
      });

      await loadVolleyballQueue();
    } catch (error) {
      toast({
        title: "Erro ao excluir",
        description: "Tente novamente",
        variant: "destructive",
      });
    }
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
          {activeFila ? (
            <>
              <div className="space-y-2">
                <p className="text-lg font-semibold">{activeFila.nome_usuario}</p>
                <Badge variant={isMyTurn() ? "default" : "secondary"} className="text-sm">
                  {isMyTurn() ? "SUA VEZ!" : "Aguarde..."}
                </Badge>
              </div>
              
              <div className={`text-3xl font-bold ${dynamicTimeRemaining <= 10 ? 'text-warning animate-pulse-sport' : 'text-primary'}`}>
                <Clock className="inline h-6 w-6 mr-2" />
                {formatTime(dynamicTimeRemaining)}
              </div>

              {isMyTurn() && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Você pode marcar até 2 nomes. Já marcou: {marksCount}/2
                  </p>
                  
                  {marksCount < 1 && (
                    <div className="space-y-3 p-4 bg-accent/10 rounded-lg">
                      <h4 className="font-medium">Primeiro Nome</h4>
                      <Input
                        placeholder="Seu nome"
                        value={firstPlayerName}
                        onChange={(e) => setFirstPlayerName(e.target.value)}
                      />
                      <Select value={firstSkillLevel} onValueChange={(value: 'iniciante' | 'intermediario' | 'avancado') => setFirstSkillLevel(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione seu nível" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iniciante">Iniciante</SelectItem>
                          <SelectItem value="intermediario">Intermediário</SelectItem>
                          <SelectItem value="avancado">Avançado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={markFirstName} 
                        variant="sport" 
                        size="lg"
                        disabled={!canMarkNames()}
                        className="w-full"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Marcar Primeiro Nome
                      </Button>
                    </div>
                  )}

                  {marksCount >= 1 && marksCount < 2 && (
                    <div className="space-y-3 p-4 bg-warning/10 rounded-lg">
                      <h4 className="font-medium">Segundo Nome (Opcional)</h4>
                      <Input
                        placeholder="Nome da segunda pessoa"
                        value={secondPlayerName}
                        onChange={(e) => setSecondPlayerName(e.target.value)}
                      />
                      <Select value={secondSkillLevel} onValueChange={(value: 'iniciante' | 'intermediario' | 'avancado') => setSecondSkillLevel(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Nível da segunda pessoa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iniciante">Iniciante</SelectItem>
                          <SelectItem value="intermediario">Intermediário</SelectItem>
                          <SelectItem value="avancado">Avançado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={markSecondName} 
                        variant="sport" 
                        size="lg"
                        disabled={!canMarkNames()}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Marcar Segundo Nome
                      </Button>
                    </div>
                  )}

                  {marksCount >= 2 && (
                    <div className="p-4 bg-green-100/50 rounded-lg">
                      <p className="text-green-800 font-medium">
                        ✅ Você já marcou 2 nomes. Aguarde o próximo turno!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Carregando fila...</p>
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
            {filaUsers.map((filaUser, index) => (
              <div 
                key={filaUser.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  filaUser.status === 'ativo'
                    ? 'bg-primary/10 border-l-4 border-primary' 
                    : filaUser.status === 'finalizado'
                      ? 'bg-muted/50 opacity-60' 
                      : 'bg-muted/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={filaUser.status === 'ativo' ? "default" : "outline"} 
                    className="text-xs"
                  >
                    {filaUser.ordem}
                  </Badge>
                  <span className={`font-medium ${filaUser.usuario_id === user?.id ? 'text-primary' : ''}`}>
                    {filaUser.nome_usuario} {filaUser.usuario_id === user?.id && '(Você)'}
                  </span>
                </div>
                {filaUser.status === 'ativo' && (
                  <Badge variant="default" className="animate-bounce-soft">
                    Ativo
                  </Badge>
                )}
                {filaUser.status === 'finalizado' && (
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