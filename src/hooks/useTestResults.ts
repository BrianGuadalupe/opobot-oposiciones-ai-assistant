
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TestResultDetail {
  questions: {
    question: string;
    user_answer: string;
    correct_answer: string;
  }[];
}

export const useTestResults = () => {
  const { session } = useAuth();

  const saveTestResult = async ({
    score,
    total_questions,
    topic,
    detail,
  }: {
    score: number;
    total_questions: number;
    topic?: string;
    detail?: TestResultDetail;
  }) => {
    if (!session) return;
    const userId = session.user.id;
    const { error } = await supabase.from("test_results").insert([
      {
        user_id: userId,
        score,
        total_questions,
        topic,
        detail,
      },
    ]);
    if (error) {
      console.error("Error guardando resultado del test:", error);
      throw error;
    }
  };

  // Otras funciones: listado de resultados, etc. (por implementar)
  return { saveTestResult };
};
