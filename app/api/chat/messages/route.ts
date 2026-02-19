import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const roomId = request.nextUrl.searchParams.get('roomId')
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
  }

  // RLS ensures user can only read messages from their own conversations
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      user_id,
      role,
      conversation_id,
      created_at,
      status,
      commands_executed,
      message_type,
      task_id,
      task_data,
      message_attachments (
        id,
        bucket_id,
        storage_path,
        file_name,
        mime_type,
        size_bytes,
        created_at
      )
    `)
    .eq('conversation_id', roomId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { content, roomId } = body

  if (!content || !roomId) {
    return NextResponse.json(
      { error: 'content and roomId are required' },
      { status: 400 }
    )
  }

  // Insert using auth.uid() from the verified session — never trust client-supplied userId
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: roomId,
      user_id: user.id,
      role: 'user',
      content,
      status: 'sent',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
