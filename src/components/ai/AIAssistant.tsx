import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  FileSpreadsheet,
  Calculator,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3
} from 'lucide-react';
import { Database } from '@/lib/types';

type AIMessage = Database['public']['Tables']['ai_messages']['Row'];
type AIConversation = Database['public']['Tables']['ai_conversations']['Row'];
type AIAction = Database['public']['Tables']['ai_actions']['Row'];

interface AIAssistantProps {
  documentId: string;
  fileData: {
    headers: string[];
    rows: Array<Record<string, string>>;
  };
  onDataUpdate: (updatedData: any) => void;
  className?: string;
}

interface ExtendedAIMessage extends AIMessage {
  actions?: AIAction[];
}

export default function AIAssistant({ 
  documentId, 
  fileData, 
  onDataUpdate, 
  className = "" 
}: AIAssistantProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ExtendedAIMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [isChatMode, setIsChatMode] = useState(true); // Default to chat mode
  const [showConversations, setShowConversations] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && documentId) {
      loadConversations();
    }
  }, [documentId, user]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    try {
      // Load all conversations for this document
      const { data: allConversations, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('document_id', documentId)
        .order('last_message_at', { ascending: false });

      if (fetchError) {
        console.error('Fetch conversations error:', fetchError);
        throw fetchError;
      }

      setConversations(allConversations || []);

      // If we have conversations, select the most recent one
      if (allConversations && allConversations.length > 0) {
        const mostRecentConversation = allConversations[0];
        setConversation(mostRecentConversation);
        await loadMessages(mostRecentConversation.id);
      } else {
        // No conversations exist, create the first one
        await createNewConversation();
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    }
  };

  const createNewConversation = async (title?: string) => {
    if (!user) return;

    try {
      const conversationTitle = title || generateConversationTitle();
      
      const { data: newConversation, error: createError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          document_id: documentId,
          title: conversationTitle,
          context_summary: `Working with file containing ${fileData.headers.length} columns and ${fileData.rows.length} rows`
        })
        .select()
        .single();

      if (createError) throw createError;

      // Update conversations list
      setConversations(prev => [newConversation, ...prev]);
      setConversation(newConversation);
      setMessages([]);
      
      toast({
        title: "New Chat Started",
        description: "Created a new conversation",
      });

    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
    }
  };

  const switchConversation = async (conversationId: string) => {
    const targetConversation = conversations.find(c => c.id === conversationId);
    if (!targetConversation) return;

    setConversation(targetConversation);
    await loadMessages(conversationId);
    setShowConversations(false);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      // Update local state
      const updatedConversations = conversations.filter(c => c.id !== conversationId);
      setConversations(updatedConversations);

      // If we deleted the active conversation, switch to another or create new
      if (conversation?.id === conversationId) {
        if (updatedConversations.length > 0) {
          const nextConversation = updatedConversations[0];
          setConversation(nextConversation);
          await loadMessages(nextConversation.id);
        } else {
          await createNewConversation();
        }
      }

      toast({
        title: "Conversation Deleted",
        description: "Conversation removed successfully",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive"
      });
    }
  };

  const generateConversationTitle = () => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Chat ${date} ${time}`;
  };

  const refreshConversations = async () => {
    if (!user) return;

    try {
      const { data: allConversations, error: fetchError } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('document_id', documentId)
        .order('last_message_at', { ascending: false });

      if (fetchError) {
        console.error('Fetch conversations error:', fetchError);
        return;
      }

      setConversations(allConversations || []);
      
      // Update current conversation if it exists in the refreshed list
      if (conversation) {
        const updatedConversation = allConversations?.find(c => c.id === conversation.id);
        if (updatedConversation) {
          setConversation(updatedConversation);
        }
      }
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('ai_messages')
        .select(`
          *,
          actions:ai_actions(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(messagesData as ExtendedAIMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !conversation || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Add user message
      const { data: userMessageData, error: userError } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversation.id,
          role: 'user',
          content: userMessage,
          message_type: 'text'
        })
        .select()
        .single();

      if (userError) throw userError;

      setMessages(prev => [...prev, userMessageData as ExtendedAIMessage]);

      // Process AI response
      const aiResponse = await processAIRequest(userMessage, conversation.id);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processAIRequest = async (userMessage: string, conversationId: string) => {
    try {
      // Call the Edge Function for AI processing
      const { data: functionResponse, error: functionError } = await supabase.functions
        .invoke('ai-assistant', {
          body: {
            conversationId,
            message: userMessage,
            fileData,
            messageType: 'text',
            chatMode: isChatMode
          }
        });

      if (functionError) {
        throw new Error(`AI service error: ${functionError.message}`);
      }

      if (!functionResponse.success) {
        throw new Error(functionResponse.error || 'AI processing failed');
      }

      // The Edge Function already stores the messages, so we just need to reload them
      await loadMessages(conversationId);
      
      // Refresh conversations list to get updated titles
      await refreshConversations();

    } catch (error) {
      console.error('Error processing AI request:', error);
      
      // Add local error message as fallback
      const { data: errorMessage } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          message_type: 'error'
        })
        .select()
        .single();

      if (errorMessage) {
        setMessages(prev => [...prev, errorMessage as ExtendedAIMessage]);
      }
    }
  };



  const getMessageIcon = (message: ExtendedAIMessage) => {
    if (message.role === 'user') return <User className="h-4 w-4" />;
    
    switch (message.message_type) {
      case 'action':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'formula':
        return <Calculator className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bot className="h-4 w-4 text-primary" />;
    }
  };

  const getMessageTypeLabel = (type: string) => {
    switch (type) {
      case 'action': return 'Action';
      case 'formula': return 'Formula';
      case 'error': return 'Error';
      default: return null;
    }
  };

  // Show loading state while user is being authenticated
  if (!user) {
    return (
      <Card className={`h-full flex flex-col ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Authenticating...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConversations(!showConversations)}
              className="h-7 w-7 p-0"
            >
              {showConversations ? <ChevronRight className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium truncate">
              {conversation?.title || 'AI Assistant'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createNewConversation()}
              className="h-7 px-2"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {isChatMode ? 'Chat' : 'Formula'}
            </span>
            <Button
              variant={isChatMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsChatMode(!isChatMode)}
              className="h-7 px-2 text-xs"
            >
              {isChatMode ? '💬' : '📊'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      {/* Conversations Sidebar */}
      {showConversations && (
        <div className="border-b">
          <CardContent className="p-3">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                <span>Conversations ({conversations.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => createNewConversation()}
                  className="h-6 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    conversation?.id === conv.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => switchConversation(conv.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString([], { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-4">
                  No conversations yet
                </div>
              )}
            </div>
          </CardContent>
        </div>
      )}
      
      <CardContent className="flex-1 flex flex-col p-4 gap-4 min-h-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 min-h-0 max-h-full" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Hi! I'm your AI assistant.</p>
                <p className="text-sm">
                  {isChatMode 
                    ? "Ask me questions about your data in natural language!" 
                    : "Request formulas, analysis, or technical help!"
                  }
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getMessageIcon(message)}
                    <span className="text-xs font-medium">
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    {message.message_type !== 'text' && (
                      <Badge variant="outline" className="text-xs">
                        {getMessageTypeLabel(message.message_type)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>
                  
                  {/* Show actions if any */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.actions.map((action) => (
                        <div key={action.id} className="flex items-center gap-2 text-xs">
                          {action.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {action.status === 'failed' && <XCircle className="h-3 w-3 text-red-500" />}
                          {action.status === 'pending' && <Clock className="h-3 w-3 text-yellow-500" />}
                          <span>{action.action_type.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t pt-4 -mx-4 px-4 bg-background">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isChatMode ? "Ask me anything about your data..." : "Ask for formulas, analysis, or help..."}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={isLoading}
            />
            <Button 
              onClick={sendMessage} 
              disabled={!inputValue.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-2">
            {isChatMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputValue('Tell me about my data')}
                  disabled={isLoading}
                >
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  About Data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputValue('What insights can you find?')}
                  disabled={isLoading}
                >
                  💡
                  Insights
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputValue('Analyze my data')}
                  disabled={isLoading}
                >
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  Analyze
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInputValue('Help me create a formula')}
                  disabled={isLoading}
                >
                  <Calculator className="h-3 w-3 mr-1" />
                  Formula
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}