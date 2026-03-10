type Props = {
  searchQuery?: string
}

const helpTopics = [
  {
    title: 'Getting Started',
    text: 'Add cameras, review recent events, and monitor threat levels from the Home dashboard.',
  },
  {
    title: 'Managing Cameras',
    text: 'Use the Cameras page to add devices, rename locations, pin important feeds, and remove inactive cameras.',
  },
  {
    title: 'Handling Alerts',
    text: 'Use the Alerts page to triage high-priority issues first, then review medium and low threats.',
  },
  {
    title: 'Camera Detail View',
    text: 'Click any camera card to open its detail page for feed playback and timeline review.',
  },
  {
    title: 'Theme and Display',
    text: 'Open Settings in the top bar to switch between light, dark, and system appearance.',
  },
]

export default function HelpPage({ searchQuery = '' }: Props) {
  const q = searchQuery.trim().toLowerCase()
  const topics = helpTopics.filter((topic) =>
    !q || `${topic.title} ${topic.text}`.toLowerCase().includes(q),
  )

  return (
    <div className="pageStack pageStackFill">
      <section className="contentPanel">
        <div className="sectionRow">
          <span className="sectionTitle">Help</span>
        </div>
        <div className="helpHero">
          <div className="helpHeroTitle">Sense Help Center</div>
          <div className="helpHeroText">
            Find quick guidance for alerts, camera management, and dashboard workflows.
          </div>
        </div>
      </section>

      <section className="contentPanel contentPanelHelpTopics pagePanelFill">
        <div className="sectionRow">
          <span className="sectionTitle">Topics</span>
        </div>
        <div className="helpTopics">
          {topics.map((topic) => (
            <div key={topic.title} className="helpTopicCard">
              <div className="helpTopicTitle">{topic.title}</div>
              <div className="helpTopicText">{topic.text}</div>
            </div>
          ))}
          {topics.length === 0 && <div className="emptyState">No help topics match your search.</div>}
        </div>
      </section>
    </div>
  )
}
