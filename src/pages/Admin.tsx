import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Crown, Users, Shuffle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Player {
  id: string;
  name: string;
  skillLevel: 'iniciante' | 'intermediario' | 'avancado';
  markedAt: Date;
  position: number;
}

interface Team {
  players: Player[];
  averageSkill: number;
}

const Admin = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<{ team1: Team; team2: Team } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Verificar se é admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== 'ptairone@hotmail.com') {
        navigate('/');
        return;
      }
    };
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const { data: queueEntries } = await supabase
      .from('volleyball_queue')
      .select('*')
      .eq('is_waiting', false)
      .order('position');

    if (queueEntries) {
      const playerList = queueEntries.map(entry => ({
        id: entry.id,
        name: entry.player_name,
        skillLevel: entry.skill_level as 'iniciante' | 'intermediario' | 'avancado',
        markedAt: new Date(entry.marked_at),
        position: entry.position
      }));
      setPlayers(playerList);
    }
  };

  const getSkillValue = (skill: string): number => {
    switch (skill) {
      case 'iniciante': return 1;
      case 'intermediario': return 2;
      case 'avancado': return 3;
      default: return 1;
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

  const generateBalancedTeams = () => {
    if (players.length < 12) {
      toast({
        title: "Times incompletos",
        description: "É preciso ter exatamente 12 jogadores para gerar os times.",
        variant: "destructive",
      });
      return;
    }

    // Separar jogadores por nível
    const advanced = players.filter(p => p.skillLevel === 'avancado');
    const intermediate = players.filter(p => p.skillLevel === 'intermediario');
    const beginners = players.filter(p => p.skillLevel === 'iniciante');

    // Distribuir jogadores alternadamente
    const team1: Player[] = [];
    const team2: Player[] = [];

    // Distribuir avançados
    advanced.forEach((player, index) => {
      if (index % 2 === 0) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });

    // Distribuir intermediários
    intermediate.forEach((player, index) => {
      if (index % 2 === 0) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });

    // Distribuir iniciantes
    beginners.forEach((player, index) => {
      if (index % 2 === 0) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });

    // Balancear se necessário (garantir 6 jogadores por time)
    while (team1.length > 6) {
      const player = team1.pop();
      if (player) team2.push(player);
    }
    
    while (team2.length > 6) {
      const player = team2.pop();
      if (player) team1.push(player);
    }

    // Calcular média de habilidade
    const calculateAverage = (team: Player[]) => {
      const total = team.reduce((sum, player) => sum + getSkillValue(player.skillLevel), 0);
      return team.length > 0 ? total / team.length : 0;
    };

    setTeams({
      team1: {
        players: team1,
        averageSkill: calculateAverage(team1)
      },
      team2: {
        players: team2,
        averageSkill: calculateAverage(team2)
      }
    });

    toast({
      title: "Times gerados!",
      description: "Os times foram balanceados com base no nível técnico.",
    });
  };

  const clearQueue = async () => {
    try {
      const { error } = await supabase.rpc('clear_volleyball_queue');

      if (error) throw error;

      setPlayers([]);
      setTeams(null);
      
      toast({
        title: "Fila de vôlei limpa",
        description: "Todos os jogadores foram removidos da fila.",
      });
      
      await loadPlayers();
    } catch (error: any) {
      toast({
        title: "Erro ao limpar fila",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const resetFila = async () => {
    try {
      const { error } = await supabase.rpc('reset_entire_fila');

      if (error) throw error;
      
      toast({
        title: "Ordem da fila resetada",
        description: "A ordem de turnos foi reiniciada com todos os usuários.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao resetar fila",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent flex items-center gap-2">
            <Crown className="h-8 w-8 text-primary" />
            Painel Admin
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <Users className="h-8 w-8 mx-auto text-accent" />
              <p className="text-2xl font-bold text-accent">{players.length}</p>
              <p className="text-sm text-muted-foreground">Jogadores</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <div className="h-8 w-8 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-800 font-bold text-sm">I</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {players.filter(p => p.skillLevel === 'iniciante').length}
              </p>
              <p className="text-sm text-muted-foreground">Iniciantes</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="space-y-2">
              <div className="h-8 w-8 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-800 font-bold text-sm">A</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                {players.filter(p => p.skillLevel === 'avancado').length}
              </p>
              <p className="text-sm text-muted-foreground">Avançados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          onClick={generateBalancedTeams}
          variant="sport"
          size="lg"
          disabled={players.length !== 12}
        >
          <Shuffle className="h-4 w-4 mr-2" />
          Gerar Times Balanceados
        </Button>
        
        <Button
          onClick={clearQueue}
          variant="destructive"
          size="lg"
        >
          Limpar Lista de Vôlei
        </Button>

        <Button
          onClick={resetFila}
          variant="outline"
          size="lg"
          className="border-warning text-warning hover:bg-warning hover:text-warning-foreground"
        >
          Resetar Ordem da Fila
        </Button>
      </div>

      {/* Current Players */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Jogadores Confirmados ({players.length}/12)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length > 0 ? (
            <div className="grid gap-2">
              {players.map((player, index) => (
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

      {/* Generated Teams */}
      {teams && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Team 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                Time 1
                <Badge className="ml-2">
                  Média: {teams.team1.averageSkill.toFixed(1)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teams.team1.players.map((player, index) => (
                  <div 
                    key={player.id}
                    className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{player.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getSkillLevelBadgeColor(player.skillLevel)}`}>
                      {player.skillLevel}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                Time 2
                <Badge className="ml-2">
                  Média: {teams.team2.averageSkill.toFixed(1)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teams.team2.players.map((player, index) => (
                  <div 
                    key={player.id}
                    className="flex items-center justify-between p-2 bg-green-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{player.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${getSkillLevelBadgeColor(player.skillLevel)}`}>
                      {player.skillLevel}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Admin;