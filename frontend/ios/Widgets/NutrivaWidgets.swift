import WidgetKit
import SwiftUI

// --- Data Model matching Shared AppGroup UserDefaults ---
struct TodaySummaryWidgetData: Codable {
    let calories: Int
    let calorieGoal: Int
    let protein: Int
    let proteinGoal: Int
    let carbs: Int
    let carbsGoal: Int
    let fat: Int
    let fatGoal: Int
    let water: Double
    let waterGoal: Double
    let waterMl: Int
    let waterGoalMl: Int
    let lastUpdated: String
    let isLoggedOut: Bool?

    static var defaultSummary: TodaySummaryWidgetData {
        TodaySummaryWidgetData(
            calories: 1542,
            calorieGoal: 2200,
            protein: 96,
            proteinGoal: 140,
            carbs: 170,
            carbsGoal: 250,
            fat: 52,
            fatGoal: 70,
            water: 1.8,
            waterGoal: 3.0,
            waterMl: 1800,
            waterGoalMl: 3000,
            lastUpdated: "",
            isLoggedOut: false
        )
    }
}

// --- Timeline Provider ---
struct NutrivaTimelineProvider: TimelineProvider {
    typealias Entry = NutrivaWidgetEntry

    func placeholder(in context: Context) -> NutrivaWidgetEntry {
        NutrivaWidgetEntry(date: Date(), summary: TodaySummaryWidgetData.defaultSummary)
    }

    func getSnapshot(in context: Context, completion: @escaping (NutrivaWidgetEntry) -> Void) {
        let entry = NutrivaWidgetEntry(date: Date(), summary: loadSummary())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NutrivaWidgetEntry>) -> Void) {
        let entry = NutrivaWidgetEntry(date: Date(), summary: loadSummary())
        // Refresh every 15 minutes or when triggered via WidgetCenter reloadAllTimelines
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadSummary() -> TodaySummaryWidgetData {
        if let userDefaults = UserDefaults(suiteName: "group.com.nutriva.ainutritioncoach"),
           let rawJson = userDefaults.string(forKey: "@nutriva_widget_today_summary"),
           let data = rawJson.data(using: .utf8),
           let summary = try? JSONDecoder().decode(TodaySummaryWidgetData.self, from: data) {
            return summary
        }
        return TodaySummaryWidgetData.defaultSummary
    }
}

struct NutrivaWidgetEntry: TimelineEntry {
    let date: Date
    let summary: TodaySummaryWidgetData
}

// --- Design Tokens ---
let nutrivaGreen = Color(red: 0.13, green: 0.77, blue: 0.37)
let nutrivaTextDark = Color(red: 0.06, green: 0.09, blue: 0.16)
let nutrivaTextMuted = Color(red: 0.40, green: 0.45, blue: 0.55)
let nutrivaBgLight = Color.white

// --- Widget 1: Today's Intake View ---
struct TodayIntakeWidgetView: View {
    var entry: NutrivaTimelineProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let s = entry.summary
        let calProgress = s.calorieGoal > 0 ? min(1.0, Double(s.calories) / Double(s.calorieGoal)) : 0.0

        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("Today's Intake")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(nutrivaTextDark)
                Spacer()
                Text("🔥 \(s.calories) / \(s.calorieGoal) kcal")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(nutrivaGreen)
            }

            Divider()

            // Macro Rows
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("🥩 Protein")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(nutrivaTextMuted)
                    Text("\(s.protein) / \(s.proteinGoal) g")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(nutrivaTextDark)
                }

                Spacer()

                VStack(alignment: .leading, spacing: 4) {
                    Text("🍚 Carbs")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(nutrivaTextMuted)
                    Text("\(s.carbs) / \(s.carbsGoal) g")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(nutrivaTextDark)
                }

                Spacer()

                VStack(alignment: .leading, spacing: 4) {
                    Text("🥑 Fat")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(nutrivaTextMuted)
                    Text("\(s.fat) / \(s.fatGoal) g")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(nutrivaTextDark)
                }
            }

            Spacer()

            // Circular Progress Ring at Bottom
            HStack {
                Spacer()
                ZStack {
                    Circle()
                        .stroke(Color.gray.opacity(0.15), lineWidth: 8)
                    Circle()
                        .trim(from: 0.0, to: CGFloat(calProgress))
                        .stroke(nutrivaGreen, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(Angle(degrees: -90))
                    VStack(spacing: 0) {
                        Text("\(Int(calProgress * 100))%")
                            .font(.system(size: 13, weight: .extrabold, design: .rounded))
                            .foregroundColor(nutrivaTextDark)
                    }
                }
                .frame(width: 44, height: 44)
                Spacer()
            }
        }
        .padding(14)
        .background(nutrivaBgLight)
    }
}

// --- Widget 2: Log Water View ---
struct LogWaterWidgetView: View {
    var entry: NutrivaTimelineProvider.Entry

    var body: some View {
        let s = entry.summary
        let waterVal = String(format: "%.1f", s.water)
        let waterGoalVal = String(format: "%.1f", s.waterGoal)

        VStack(spacing: 10) {
            // Header
            HStack {
                Text("💧 Water")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color.blue)
                Spacer()
                Text("\(waterVal) L / \(waterGoalVal) L")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(nutrivaTextDark)
            }

            // Quick Action Buttons using SwiftUI Link
            HStack(spacing: 6) {
                Link(destination: URL(string: "nutriva://water/log?ml=250")!) {
                    Text("+250 ml")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.white)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(nutrivaGreen)
                        .cornerRadius(10)
                }

                Link(destination: URL(string: "nutriva://water/log?ml=500")!) {
                    Text("+500 ml")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color.white)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(nutrivaGreen)
                        .cornerRadius(10)
                }

                Link(destination: URL(string: "nutriva://water/reset")!) {
                    Text("Reset")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(nutrivaTextDark)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity)
                        .background(Color.gray.opacity(0.15))
                        .cornerRadius(10)
                }
            }
        }
        .padding(14)
        .background(nutrivaBgLight)
    }
}

// --- Widget Declarations ---
struct TodayIntakeWidget: Widget {
    let kind: String = "TodayIntakeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutrivaTimelineProvider()) { entry in
            TodayIntakeWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's Intake")
        .description("Track your daily calories and macros at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct LogWaterWidget: Widget {
    let kind: String = "LogWaterWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NutrivaTimelineProvider()) { entry in
            LogWaterWidgetView(entry: entry)
        }
        .configurationDisplayName("Log Water")
        .description("Log water intake instantly without opening the app.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct NutrivaWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayIntakeWidget()
        LogWaterWidget()
    }
}
