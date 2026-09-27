export const MEDICAL_REDIRECT = "For an injury or rehabilitation plan, use exercises provided by your healthcare professional. If you have a Home Exercise Program, upload it in My HEP and RehabVerse can turn that plan into an interactive quest.";
export const WELLNESS_LABEL = "General wellness movement experience — not personalized medical treatment.";
export function isMedicalRequest(input: string): boolean {
  const text = input.normalize("NFKC").toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "");
  return /\b(injur\w*|diagnos\w*|pain\w*|hurt\w*|ach(?:e|es|ing)|sor(?:e|eness)|rehab\w*|therap\w*|treat\w*|surger\w*|surgical|post[ -]?op\w*|operat(?:ion|ed)|recover\w*|heal\w*|medical|condition|disease|disorder|syndrome|disabil\w*|fractur\w*|sprain\w*|strain\w*|torn|tear|tore|acl|mcl|pcl|lcl|meniscus|rotator|arthritis|arthritic|osteo\w*|sciatic\w*|tendin\w*|tendon\w*|bursitis|impingement|herniat\w*|disc|disk|stroke|parkinson\w*|scoliosis|fibromyal\w*|neuropath\w*|diabet\w*|hypertension|cardiac|heart|asthma|cancer|pregnan\w*|postpartum|concussion|replacement|fusion|numb\w*|tingl\w*|swoll\w*|swelling|symptom\w*|doctor|physio\w*|pt|hep)\b/i.test(text);
}
export function isWellnessRequest(input: string) {
  return !isMedicalRequest(input) && /\b(mov(?:e|ing|ement)|break|wellness|beginner|upper[ -]body|lower[ -]body|standing|seated|sitting|desk|light|gentle|quest|game|exercise|session|active|activity)\b/i.test(input.normalize("NFKC"));
}
