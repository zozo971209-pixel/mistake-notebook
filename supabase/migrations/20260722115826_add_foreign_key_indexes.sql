create index questions_subject_owner_idx
  on public.questions(subject_id, user_id);

create index review_records_question_owner_idx
  on public.review_records(question_id, user_id);

create index ai_conversations_user_idx
  on public.ai_conversations(user_id);

create index ai_conversations_question_owner_idx
  on public.ai_conversations(question_id, user_id);

create index ai_messages_user_idx
  on public.ai_messages(user_id);

create index ai_messages_conversation_owner_idx
  on public.ai_messages(conversation_id, user_id);
